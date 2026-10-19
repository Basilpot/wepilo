import { Hono } from "hono";
import { z } from "zod";
import { eq, and, desc, count, asc } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AppEnv } from "@/types";
import { ApiError, paginate, paginationSchema } from "@/lib/http";
import { requireStaff, requireTenant } from "@/middleware/context";
import { hashPassword } from "@/lib/auth";

// ── Support tickets ──────────────────────────────────────────────────────────

export const supportRoutes = new Hono<AppEnv>()
  .get("/", requireStaff(), requireTenant(), async (c) => {
    const db = c.get("db");
    const q = paginationSchema
      .extend({ status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]).optional() })
      .parse(c.req.query());
    const tenantId = c.get("tenantId");
    const staff = c.get("staff")!;
    const conditions = [eq(schema.supportTickets.tenantId, tenantId)];
    if (staff.role !== "OWNER" && staff.role !== "ADMIN") {
      conditions.push(eq(schema.supportTickets.creatorId, staff.id));
    }
    if (q.status) conditions.push(eq(schema.supportTickets.status, q.status));

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

export const authorRoutes = new Hono<AppEnv>()
  .get("/", requireStaff(), requireTenant(), async (c) => {
    const db = c.get("db");
    const rows = await db.query.authors.findMany({
      where: eq(schema.authors.tenantId, c.get("tenantId")),
      columns: { id: true, username: true, name: true, email: true, bio: true, image: true, createdAt: true },
    });
    return c.json({ data: rows });
  })
  .post("/", requireStaff(), requireTenant(), async (c) => {
    const body = z
      .object({
        username: z.string().min(3).max(40),
        name: z.string().optional(),
        email: z.string().email(),
        password: z.string().min(8),
        bio: z.string().optional(),
        image: z.string().optional(),
      })
      .parse(await c.req.json());
    const db = c.get("db");
    const tenantId = c.get("tenantId");
    const existing = await db.query.authors.findFirst({
      where: and(eq(schema.authors.tenantId, tenantId), eq(schema.authors.username, body.username.toLowerCase())),
    });
    if (existing) throw new ApiError(409, "Username already taken");
    const [author] = await db
      .insert(schema.authors)
      .values({
        tenantId,
        username: body.username.toLowerCase(),
        name: body.name ?? null,
        email: body.email.toLowerCase(),
        password: await hashPassword(body.password),
        bio: body.bio ?? null,
        image: body.image ?? null,
      })
      .returning({ id: schema.authors.id, username: schema.authors.username, name: schema.authors.name, email: schema.authors.email });
    return c.json({ author }, 201);
  })
  .patch("/:id", requireStaff(), requireTenant(), async (c) => {
    const body = z
      .object({
        name: z.string().optional(),
        bio: z.string().optional(),
        image: z.string().optional(),
        password: z.string().min(8).optional(),
      })
      .parse(await c.req.json());
    const db = c.get("db");
    const [row] = await db
      .update(schema.authors)
      .set({
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.bio !== undefined ? { bio: body.bio } : {}),
        ...(body.image !== undefined ? { image: body.image } : {}),
        ...(body.password ? { password: await hashPassword(body.password) } : {}),
        updatedAt: new Date(),
      })
      .where(
        and(eq(schema.authors.id, Number(c.req.param("id"))), eq(schema.authors.tenantId, c.get("tenantId"))),
      )
      .returning({ id: schema.authors.id });
    if (!row) throw new ApiError(404, "Author not found");
    return c.json({ author: row });
  })
  .delete("/:id", requireStaff("OWNER", "ADMIN"), requireTenant(), async (c) => {
    const db = c.get("db");
    await db
      .delete(schema.authors)
      .where(
        and(eq(schema.authors.id, Number(c.req.param("id"))), eq(schema.authors.tenantId, c.get("tenantId"))),
      );
    return c.json({ ok: true });
  });

// ── Public homepage sections ─────────────────────────────────────────────────

export const publicRoutes = new Hono<AppEnv>()
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
