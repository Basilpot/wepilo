import { Hono } from "hono";
import { z } from "zod";
import { and, asc, count, desc, eq, inArray, or } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AppEnv } from "@/types";
import { ApiError, contains, paginate, paginationSchema } from "@/lib/http";
import { requirePlatformAdmin } from "@/middleware/context";
import { notifyTenantOfReply } from "@/lib/support-mail";

/**
 * Wepilo's own support inbox: every request an agency has sent, across every workspace.
 * A platform admin answers from here, and the agency is emailed when they do.
 */

const STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;

export const platformSupportRoutes = new Hono<AppEnv>()
  .use("*", requirePlatformAdmin)
  .get("/", async (c) => {
    const db = c.get("db");
    const q = paginationSchema
      .extend({
        status: z.enum(STATUSES).optional(),
        priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
        search: z.string().trim().max(100).optional(),
      })
      .parse(c.req.query());

    const conditions = [];
    if (q.status) conditions.push(eq(schema.supportTickets.status, q.status));
    if (q.priority) conditions.push(eq(schema.supportTickets.priority, q.priority));
    if (q.search) {
      conditions.push(
        or(
          contains(schema.supportTickets.subject, q.search),
          contains(schema.supportTickets.message, q.search),
        ),
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;

    const [rows, [total]] = await Promise.all([
      db.query.supportTickets.findMany({
        where,
        with: {
          tenant: { columns: { id: true, companyName: true, slug: true, email: true, plan: true } },
          creator: { columns: { id: true, name: true, email: true } },
        },
        orderBy: [desc(schema.supportTickets.createdAt)],
        limit: q.limit,
        offset: (q.page - 1) * q.limit,
      }),
      db.select({ value: count() }).from(schema.supportTickets).where(where),
    ]);

    // How many answers each one already has, so the inbox can show what still needs a reply.
    const counts = rows.length
      ? await db
          .select({ ticketId: schema.supportTicketReplies.ticketId, value: count() })
          .from(schema.supportTicketReplies)
          .where(inArray(schema.supportTicketReplies.ticketId, rows.map((r) => r.id)))
          .groupBy(schema.supportTicketReplies.ticketId)
      : [];
    const countByTicket = new Map(counts.map((c) => [c.ticketId, c.value]));

    return c.json(
      paginate(
        rows.map((t) => ({
          id: t.id,
          subject: t.subject,
          category: t.category,
          status: t.status,
          priority: t.priority,
          creatorName: t.creatorName,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
          tenant: t.tenant,
          creator: t.creator,
          replyCount: countByTicket.get(t.id) ?? 0,
        })),
        q.page,
        q.limit,
        total.value,
      ),
    );
  })
  .get("/:id", async (c) => {
    const db = c.get("db");
    const ticket = await db.query.supportTickets.findFirst({
      where: eq(schema.supportTickets.id, Number(c.req.param("id"))),
      with: {
        tenant: { columns: { id: true, companyName: true, slug: true, email: true, plan: true } },
        creator: { columns: { id: true, name: true, email: true, role: true } },
        replies: {
          with: { staff: { columns: { id: true, name: true, role: true } } },
          orderBy: [asc(schema.supportTicketReplies.createdAt)],
        },
      },
    });
    if (!ticket) throw new ApiError(404, "Ticket not found");
    const attachments = await db.query.supportAttachments.findMany({
      where: eq(schema.supportAttachments.ticketId, ticket.id),
      columns: { r2Key: false },
      orderBy: [asc(schema.supportAttachments.createdAt)],
    });
    return c.json({ ticket: { ...ticket, attachments } });
  })
  // Wepilo answers. The reply lands in the agency's own thread, and they are emailed.
  .post("/:id/replies", async (c) => {
    const body = z.object({ message: z.string().trim().min(1).max(8000) }).parse(await c.req.json());
    const db = c.get("db");
    const admin = c.get("platformAdmin")!;
    const ticket = await db.query.supportTickets.findFirst({
      where: eq(schema.supportTickets.id, Number(c.req.param("id"))),
    });
    if (!ticket) throw new ApiError(404, "Ticket not found");

    const [reply] = await db
      .insert(schema.supportTicketReplies)
      .values({
        ticketId: ticket.id,
        // No staff row: this reply is from the Wepilo team, not from the agency.
        staffId: null,
        authorName: admin.name,
        message: body.message,
      })
      .returning();

    // A reply means someone is on it.
    if (ticket.status === "OPEN") {
      await db
        .update(schema.supportTickets)
        .set({ status: "IN_PROGRESS", updatedAt: new Date() })
        .where(eq(schema.supportTickets.id, ticket.id));
    }

    const task = notifyTenantOfReply(c.env, db, ticket.id, { authorName: admin.name, message: body.message });
    try {
      c.executionCtx.waitUntil(task);
    } catch {
      await task;
    }
    return c.json({ reply }, 201);
  })
  .patch("/:id/status", async (c) => {
    const body = z.object({ status: z.enum(STATUSES) }).parse(await c.req.json());
    const db = c.get("db");
    const [ticket] = await db
      .update(schema.supportTickets)
      .set({ status: body.status, updatedAt: new Date() })
      .where(eq(schema.supportTickets.id, Number(c.req.param("id"))))
      .returning();
    if (!ticket) throw new ApiError(404, "Ticket not found");
    return c.json({ ticket });
  })
  // The agency's attachments. Same file, served by the Wepilo team.
  .get("/:id/attachments/:attachmentId", async (c) => {
    const db = c.get("db");
    const row = await db.query.supportAttachments.findFirst({
      where: and(
        eq(schema.supportAttachments.id, Number(c.req.param("attachmentId"))),
        eq(schema.supportAttachments.ticketId, Number(c.req.param("id"))),
      ),
    });
    if (!row) throw new ApiError(404, "Attachment not found");
    const object = await c.env.MEDIA.get(row.r2Key);
    if (!object) throw new ApiError(404, "Attachment not found");
    return new Response(object.body, {
      headers: {
        "Content-Type": row.mimeType,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(row.filename)}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=300",
      },
    });
  });
