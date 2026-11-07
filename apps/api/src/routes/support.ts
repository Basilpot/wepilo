import { Hono } from "hono";
import { z } from "zod";
import { eq, and, desc, count, asc } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AppEnv } from "@/types";
import { ApiError, paginate, paginationSchema, contains } from "@/lib/http";
import { getRates } from "@/lib/fx";
import { requireStaff, requireTenant } from "@/middleware/context";
import { hashPassword } from "@/lib/auth";
import { enforce } from "@/lib/rate-limit";
import type { Context } from "hono";

// ── Support tickets ──────────────────────────────────────────────────────────

const ATTACHMENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf", "text/plain"]);
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

/** The ticket, if it is in this workspace and the signed-in person may see it. */
async function ownTicket(c: Context<AppEnv>, id: number) {
  const staff = c.get("staff")!;
  const ticket = await c.get("db").query.supportTickets.findFirst({
    where: and(eq(schema.supportTickets.id, id), eq(schema.supportTickets.tenantId, staff.tenantId)),
  });
  if (!ticket) throw new ApiError(404, "Ticket not found");
  if (staff.role !== "OWNER" && staff.role !== "ADMIN" && ticket.creatorId !== staff.id) throw new ApiError(403, "Not your ticket");
  return ticket;
}

export const supportRoutes = new Hono<AppEnv>()
  .get("/", requireStaff(), requireTenant(), async (c) => {
    const db = c.get("db");
    const q = paginationSchema
      .extend({ status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]).optional(), search: z.string().trim().max(100).optional() })
      .parse(c.req.query());
    const tenantId = c.get("tenantId");
    const staff = c.get("staff")!;
    const conditions = [eq(schema.supportTickets.tenantId, tenantId)];
    if (staff.role !== "OWNER" && staff.role !== "ADMIN") {
      conditions.push(eq(schema.supportTickets.creatorId, staff.id));
    }
    if (q.status) conditions.push(eq(schema.supportTickets.status, q.status));
    if (q.search) conditions.push(contains(schema.supportTickets.subject, q.search));

    const [totalRow] = await db
      .select({ value: count() })
      .from(schema.supportTickets)
      .where(and(...conditions));
    const rows = await db.query.supportTickets.findMany({
      where: and(...conditions),
      orderBy: [desc(schema.supportTickets.createdAt)],
      limit: q.limit,
      offset: (q.page - 1) * q.limit,
    });
    return c.json(paginate(rows, q.page, q.limit, totalRow.value));
  })
  .post("/", requireStaff(), requireTenant(), async (c) => {
    const body = z
      .object({
        category: z.string().min(1),
        subject: z.string().min(1),
        message: z.string().min(1),
        callbackNumber: z.string().optional(),
        priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
      })
      .parse(await c.req.json());
    const db = c.get("db");
    const staff = c.get("staff")!;
    const [ticket] = await db
      .insert(schema.supportTickets)
      .values({
        tenantId: staff.tenantId,
        creatorId: staff.id,
        creatorName: staff.name,
        category: body.category,
        subject: body.subject,
        message: body.message,
        callbackNumber: body.callbackNumber || null,
        priority: body.priority,
      })
      .returning();
    return c.json({ ticket }, 201);
  })
  .get("/:id", requireStaff(), requireTenant(), async (c) => {
    const db = c.get("db");
    const staff = c.get("staff")!;
    const ticket = await db.query.supportTickets.findFirst({
      where: and(
        eq(schema.supportTickets.id, Number(c.req.param("id"))),
        eq(schema.supportTickets.tenantId, staff.tenantId),
      ),
      with: { replies: { with: { staff: { columns: { id: true, name: true, role: true } } }, orderBy: [asc(schema.supportTicketReplies.createdAt)] } },
    });
    if (!ticket) throw new ApiError(404, "Ticket not found");
    if (staff.role !== "OWNER" && staff.role !== "ADMIN" && ticket.creatorId !== staff.id) {
      throw new ApiError(403, "Not your ticket");
    }
    return c.json({ ticket });
  })
  .post("/:id/replies", requireStaff(), requireTenant(), async (c) => {
    const body = z.object({ message: z.string().min(1) }).parse(await c.req.json());
    const db = c.get("db");
    const staff = c.get("staff")!;
    const ticket = await db.query.supportTickets.findFirst({
      where: and(
        eq(schema.supportTickets.id, Number(c.req.param("id"))),
        eq(schema.supportTickets.tenantId, staff.tenantId),
      ),
    });
    if (!ticket) throw new ApiError(404, "Ticket not found");
    const [reply] = await db
      .insert(schema.supportTicketReplies)
      .values({
        ticketId: ticket.id,
        staffId: staff.id,
        authorName: staff.name,
        message: body.message,
      })
      .returning();
    return c.json({ reply }, 201);
  })
  // Attachments: private files on a ticket, visible to the ticket's owner and workspace admins.
  .get("/:id/attachments", requireStaff(), requireTenant(), async (c) => {
    const ticket = await ownTicket(c, Number(c.req.param("id")));
    const rows = await c.get("db").query.supportAttachments.findMany({
      where: eq(schema.supportAttachments.ticketId, ticket.id),
      columns: { r2Key: false },
      orderBy: [asc(schema.supportAttachments.createdAt)],
    });
    return c.json({ data: rows });
  })
  .post("/:id/attachments", requireStaff(), requireTenant(), async (c) => {
    const db = c.get("db");
    const ticket = await ownTicket(c, Number(c.req.param("id")));
    await enforce(db, { name: "support-upload", max: 30, windowSeconds: 60 * 60 }, String(ticket.tenantId));
    const file = (await c.req.formData()).get("file");
    if (!(file instanceof File)) throw new ApiError(400, "file field is required");
    if (!ATTACHMENT_TYPES.has(file.type)) throw new ApiError(415, "Attach an image, PDF or text file.");
    if (file.size === 0) throw new ApiError(400, "That file is empty.");
    if (file.size > MAX_ATTACHMENT_BYTES) throw new ApiError(413, "Attachments can be up to 5MB.");
    const [{ value: existing }] = await db.select({ value: count() }).from(schema.supportAttachments).where(eq(schema.supportAttachments.ticketId, ticket.id));
    if (existing >= 10) throw new ApiError(409, "A ticket can have up to 10 attachments.", "TOO_MANY_ATTACHMENTS");

    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
    // Private prefix: the public /media/file route only serves "tenants/".
    const r2Key = `support/${ticket.tenantId}/${ticket.id}/${crypto.randomUUID()}-${safe}`;
    await c.env.MEDIA.put(r2Key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
    const [row] = await db
      .insert(schema.supportAttachments)
      .values({ tenantId: ticket.tenantId, ticketId: ticket.id, filename: file.name.slice(0, 200), mimeType: file.type, size: file.size, r2Key, uploadedByName: c.get("staff")!.name })
      .returning();
    const { r2Key: _key, ...visible } = row;
    return c.json({ attachment: visible }, 201);
  })
  .get("/:id/attachments/:attachmentId", requireStaff(), requireTenant(), async (c) => {
    const ticket = await ownTicket(c, Number(c.req.param("id")));
    const row = await c.get("db").query.supportAttachments.findFirst({
      where: and(eq(schema.supportAttachments.id, Number(c.req.param("attachmentId"))), eq(schema.supportAttachments.ticketId, ticket.id)),
    });
    if (!row) throw new ApiError(404, "Attachment not found");
    const object = await c.env.MEDIA.get(row.r2Key);
    if (!object) throw new ApiError(404, "Attachment not found");
    // Served as a download with a fixed type, so an uploaded file can never run as a page.
    return new Response(object.body, {
      headers: {
        "Content-Type": row.mimeType,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(row.filename)}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=300",
      },
    });
  })
  .delete("/:id/attachments/:attachmentId", requireStaff(), requireTenant(), async (c) => {
    const ticket = await ownTicket(c, Number(c.req.param("id")));
    const db = c.get("db");
    const row = await db.query.supportAttachments.findFirst({
      where: and(eq(schema.supportAttachments.id, Number(c.req.param("attachmentId"))), eq(schema.supportAttachments.ticketId, ticket.id)),
    });
    if (!row) throw new ApiError(404, "Attachment not found");
    await c.env.MEDIA.delete(row.r2Key);
    await db.delete(schema.supportAttachments).where(eq(schema.supportAttachments.id, row.id));
    return c.json({ ok: true });
  })
  .patch("/:id/status", requireStaff(), requireTenant(), async (c) => {
    const body = z
      .object({ status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]) })
      .parse(await c.req.json());
    const db = c.get("db");
    const [row] = await db
      .update(schema.supportTickets)
      .set({ status: body.status, updatedAt: new Date() })
      .where(
        and(
          eq(schema.supportTickets.id, Number(c.req.param("id"))),
          eq(schema.supportTickets.tenantId, c.get("tenantId")),
        ),
      )
      .returning();
    if (!row) throw new ApiError(404, "Ticket not found");
    return c.json({ ticket: row });
  });

// ── Blog authors ─────────────────────────────────────────────────────────────
// Writers are staff logins (any role, "Author" for people who only write). This lists the people a post can be credited to.

export const authorRoutes = new Hono<AppEnv>().get("/", requireStaff(), requireTenant(), async (c) => {
  const db = c.get("db");
  const rows = await db.query.tenantStaff.findMany({
    where: and(eq(schema.tenantStaff.tenantId, c.get("tenantId")), eq(schema.tenantStaff.isActive, true)),
    columns: { id: true, username: true, name: true, email: true, bio: true, image: true, role: true, createdAt: true },
    orderBy: [asc(schema.tenantStaff.name)],
  });
  return c.json({ data: rows });
});

// ── Public homepage sections ─────────────────────────────────────────────────

export const publicRoutes = new Hono<AppEnv>()
  // Lets a website show prices in the visitor's currency. Only answers with rates when the agency has switched translation on.
  .get("/currency", requireTenant(), async (c) => {
    const db = c.get("db");
    const settings = await db.query.tenantPaymentSettings.findFirst({
      where: eq(schema.tenantPaymentSettings.tenantId, c.get("tenantId")),
      columns: { currency: true, currencyTranslation: true },
    });
    const base = settings?.currency ?? "USD";
    if (!settings?.currencyTranslation) return c.json({ base, translation: false, rates: null, updatedAt: null });
    const { rates, updatedAt } = await getRates(c.env, base);
    return c.json({ base, translation: true, rates, updatedAt, source: "https://www.exchangerate-api.com" });
  })
  .get("/homepage/sections", requireTenant(), async (c) => {
    const db = c.get("db");
    const tenantId = c.get("tenantId");
    const [categories, locations, tags] = await Promise.all([
      db.query.tripCategories.findMany({
        where: and(eq(schema.tripCategories.tenantId, tenantId), eq(schema.tripCategories.showOnHomepage, true)),
      }),
      db.query.locations.findMany({
        where: and(eq(schema.locations.tenantId, tenantId), eq(schema.locations.showOnHomepage, true)),
      }),
      db.query.featuredTags.findMany({
        where: and(eq(schema.featuredTags.tenantId, tenantId), eq(schema.featuredTags.showOnHomepage, true)),
        orderBy: [asc(schema.featuredTags.order)],
      }),
    ]);
    const ofType = (type: string) => locations.filter((l) => l.type === type);
    return c.json({
      categories,
      regions: ofType("REGION"),
      cities: ofType("CITY"),
      countries: ofType("COUNTRY"),
      tags,
    });
  })
  .get("/testimonials/public", requireTenant(), async (c) => {
    const db = c.get("db");
    const rows = await db.query.testimonials.findMany({
      where: eq(schema.testimonials.tenantId, c.get("tenantId")),
      orderBy: [desc(schema.testimonials.createdAt)],
      limit: 20,
    });
    return c.json({ data: rows });
  })
  .get("/team/public", requireTenant(), async (c) => {
    const db = c.get("db");
    const tenantId = c.get("tenantId");
    const departments = await db.query.teamDepartments.findMany({
      where: eq(schema.teamDepartments.tenantId, tenantId),
    });
    const members = await db.query.teamMembers.findMany({
      where: eq(schema.teamMembers.tenantId, tenantId),
      with: { department: { columns: { id: true, name: true } } },
    });
    return c.json({ departments, members });
  });
