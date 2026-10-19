import { Hono } from "hono";
import { z } from "zod";
import { eq, and, desc, count, sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AppEnv } from "@/types";
import { ApiError, paginate, paginationSchema, slugify } from "@/lib/http";
import { requireStaff, requireTenant, requireUser } from "@/middleware/context";
import { randomApiKey } from "@/lib/crypto";
import { sendEmail, layout, escapeHtml } from "@/lib/email";

// ── Reviews ──────────────────────────────────────────────────────────────────

export const reviewRoutes = new Hono<AppEnv>()
  .get("/", requireTenant(), async (c) => {
    const db = c.get("db");
    const q = paginationSchema
      .extend({ activityId: z.coerce.number().int().optional() })
      .parse(c.req.query());
    const conditions = [eq(schema.reviews.tenantId, c.get("tenantId"))];
    if (q.activityId) conditions.push(eq(schema.reviews.activityId, q.activityId));
    const [totalRow] = await db.select({ value: count() }).from(schema.reviews).where(and(...conditions));
    const rows = await db.query.reviews.findMany({
      where: and(...conditions),
      with: {
        activity: { columns: { id: true, title: true, slug: true } },
        reviewer: { columns: { id: true, name: true, image: true } },
      },
      orderBy: [desc(schema.reviews.createdAt)],
      limit: q.limit,
      offset: (q.page - 1) * q.limit,
    });
    return c.json(paginate(rows, q.page, q.limit, totalRow.value));
  })
  .post("/", requireUser(), requireTenant(), async (c) => {
    const body = z
      .object({
        activityId: z.number().int(),
        rating: z.number().int().min(1).max(5),
        text: z.string().optional(),
      })
      .parse(await c.req.json());
    const db = c.get("db");
    const user = c.get("user")!;
    const tenantId = c.get("tenantId");

    const activity = await db.query.activities.findFirst({
      where: and(eq(schema.activities.id, body.activityId), eq(schema.activities.tenantId, tenantId)),
    });
    if (!activity) throw new ApiError(404, "Activity not found");

    const existing = await db.query.reviews.findFirst({
      where: and(eq(schema.reviews.reviewerId, user.id), eq(schema.reviews.activityId, body.activityId)),
    });
    if (existing) throw new ApiError(409, "You already reviewed this trip");

    const [review] = await db
      .insert(schema.reviews)
      .values({
        tenantId,
        reviewerId: user.id,
        activityId: body.activityId,
        rating: body.rating,
        text: body.text ?? null,
      })
      .returning();

    await db.run(sql`
      UPDATE ${schema.activities}
      SET average_rating = (SELECT ROUND(AVG(${schema.reviews.rating}), 1) FROM ${schema.reviews} WHERE ${schema.reviews.activityId} = ${body.activityId}),
          updated_at = unixepoch() * 1000
      WHERE id = ${body.activityId}
    `);

    return c.json({ review }, 201);
  })
  .delete("/:id", requireUser(), requireTenant(), async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;
    const deleted = await db
      .delete(schema.reviews)
      .where(
        and(
          eq(schema.reviews.id, Number(c.req.param("id"))),
          eq(schema.reviews.reviewerId, user.id),
        ),
      )
      .returning({ id: schema.reviews.id, activityId: schema.reviews.activityId });
    if (!deleted.length) throw new ApiError(404, "Review not found");
    await db.run(sql`
      UPDATE ${schema.activities}
      SET average_rating = COALESCE((SELECT ROUND(AVG(${schema.reviews.rating}), 1) FROM ${schema.reviews} WHERE ${schema.reviews.activityId} = ${deleted[0].activityId}), 0),
          updated_at = unixepoch() * 1000
      WHERE id = ${deleted[0].activityId}
    `);
    return c.json({ ok: true });
  });

// ── Wishlist ─────────────────────────────────────────────────────────────────

export const wishlistRoutes = new Hono<AppEnv>()
  .get("/", requireUser(), requireTenant(), async (c) => {
    const db = c.get("db");
    const rows = await db.query.wishlists.findMany({
      where: eq(schema.wishlists.userId, c.get("user")!.id),
      with: {
        activity: {
          columns: { id: true, title: true, slug: true, price: true, images: true, duration: true, averageRating: true },
        },
      },
      orderBy: [desc(schema.wishlists.createdAt)],
    });
    return c.json({ data: rows });
  })
  .get("/check/:activityId", requireUser(), async (c) => {
    const db = c.get("db");
    const row = await db.query.wishlists.findFirst({
      where: and(
        eq(schema.wishlists.userId, c.get("user")!.id),
        eq(schema.wishlists.itemId, Number(c.req.param("activityId"))),
      ),
    });
    return c.json({ active: Boolean(row) });
  })
  .put("/:activityId", requireUser(), requireTenant(), async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;
    const itemId = Number(c.req.param("activityId"));
    const existing = await db.query.wishlists.findFirst({
      where: and(eq(schema.wishlists.userId, user.id), eq(schema.wishlists.itemId, itemId)),
    });
    if (existing) {
      await db.delete(schema.wishlists).where(eq(schema.wishlists.id, existing.id));
      return c.json({ active: false });
    }
    await db.insert(schema.wishlists).values({ tenantId: user.tenantId, userId: user.id, itemId });
    return c.json({ active: true });
  });

// ── Testimonials ─────────────────────────────────────────────────────────────

export const testimonialRoutes = new Hono<AppEnv>()
  .get("/", requireTenant(), async (c) => {
    const db = c.get("db");
    const rows = await db.query.testimonials.findMany({
      where: eq(schema.testimonials.tenantId, c.get("tenantId")),
      orderBy: [desc(schema.testimonials.createdAt)],
    });
    return c.json({ data: rows });
  })
  .post("/", requireStaff("OWNER", "ADMIN", "MANAGER"), requireTenant(), async (c) => {
    const body = z
      .object({
        rating: z.number().int().min(1).max(5).nullable().optional(),
        content: z.string().min(1),
        author: z.string().nullable().optional(),
        media: z.string().nullable().optional(),
      })
      .parse(await c.req.json());
    const db = c.get("db");
    const [row] = await db
      .insert(schema.testimonials)
      .values({
        tenantId: c.get("tenantId"),
        rating: body.rating ?? null,
        content: body.content,
        author: body.author ?? null,
        media: body.media ?? null,
      })
      .returning();
    return c.json({ testimonial: row }, 201);
  })
  .patch("/:id", requireStaff("OWNER", "ADMIN", "MANAGER"), requireTenant(), async (c) => {
    const body = z
      .object({
        rating: z.number().int().min(1).max(5).nullable().optional(),
        content: z.string().min(1).optional(),
        author: z.string().nullable().optional(),
        media: z.string().nullable().optional(),
      })
      .parse(await c.req.json());
    const db = c.get("db");
    const [row] = await db
      .update(schema.testimonials)
      .set({ ...body, updatedAt: new Date() })
      .where(
        and(
          eq(schema.testimonials.id, Number(c.req.param("id"))),
          eq(schema.testimonials.tenantId, c.get("tenantId")),
        ),
      )
      .returning();
    if (!row) throw new ApiError(404, "Testimonial not found");
    return c.json({ testimonial: row });
  })
  .delete("/:id", requireStaff("OWNER", "ADMIN"), requireTenant(), async (c) => {
    const db = c.get("db");
    await db
      .delete(schema.testimonials)
      .where(
        and(
          eq(schema.testimonials.id, Number(c.req.param("id"))),
          eq(schema.testimonials.tenantId, c.get("tenantId")),
        ),
      );
    return c.json({ ok: true });
  });

// ── Newsletter ───────────────────────────────────────────────────────────────

export const newsletterRoutes = new Hono<AppEnv>()
  .get("/", requireStaff(), requireTenant(), async (c) => {
    const db = c.get("db");
    const q = paginationSchema.parse(c.req.query());
    const tenantId = c.get("tenantId");
    const [totalRow] = await db
      .select({ value: count() })
      .from(schema.newsletterSubscribers)
      .where(eq(schema.newsletterSubscribers.tenantId, tenantId));
    const rows = await db.query.newsletterSubscribers.findMany({
      where: eq(schema.newsletterSubscribers.tenantId, tenantId),
      orderBy: [desc(schema.newsletterSubscribers.createdAt)],
      limit: q.limit,
      offset: (q.page - 1) * q.limit,
    });
    return c.json(paginate(rows, q.page, q.limit, totalRow.value));
  })
  .post("/subscribe", requireTenant(), async (c) => {
    const body = z.object({ email: z.string().email() }).parse(await c.req.json());
    const db = c.get("db");
    const tenantId = c.get("tenantId");
    const email = body.email.toLowerCase();
    const unsubSecret = randomApiKey();
    await db
      .insert(schema.newsletterSubscribers)
      .values({ tenantId, email, unsubSecret, isActive: true })
      .onConflictDoUpdate({
        target: [schema.newsletterSubscribers.tenantId, schema.newsletterSubscribers.email],
        set: { isActive: true, unsubscribedAt: null, updatedAt: new Date() },
      });
    return c.json({ ok: true }, 201);
  })
  .get("/unsubscribe/:secret", async (c) => {
    const db = c.get("db");
    const row = await db.query.newsletterSubscribers.findFirst({
      where: eq(schema.newsletterSubscribers.unsubSecret, c.req.param("secret")),
    });
    if (row && row.isActive) {
      await db
        .update(schema.newsletterSubscribers)
        .set({ isActive: false, unsubscribedAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.newsletterSubscribers.id, row.id));
    }
    return c.json({ ok: true });
  })
  .patch("/:id/toggle", requireStaff(), requireTenant(), async (c) => {
    const db = c.get("db");
    const id = Number(c.req.param("id"));
    const row = await db.query.newsletterSubscribers.findFirst({
      where: and(
        eq(schema.newsletterSubscribers.id, id),
        eq(schema.newsletterSubscribers.tenantId, c.get("tenantId")),
      ),
    });
    if (!row) throw new ApiError(404, "Subscriber not found");
    const [updated] = await db
      .update(schema.newsletterSubscribers)
      .set({ isActive: !row.isActive, updatedAt: new Date() })
      .where(eq(schema.newsletterSubscribers.id, id))
      .returning();
    return c.json({ subscriber: updated });
  })
  .post("/send", requireStaff("OWNER", "ADMIN", "MANAGER"), requireTenant(), async (c) => {
    const body = z
      .object({ subject: z.string().min(1), html: z.string().min(1) })
      .parse(await c.req.json());
    const db = c.get("db");
    const tenantId = c.get("tenantId");
    const subscribers = await db.query.newsletterSubscribers.findMany({
      where: and(eq(schema.newsletterSubscribers.tenantId, tenantId), eq(schema.newsletterSubscribers.isActive, true)),
    });
    let sent = 0;
    for (const subscriber of subscribers) {
      const ok = await sendEmail({
        apiKey: c.env.RESEND_API_KEY,
        from: c.env.PLATFORM_EMAIL_FROM,
        to: subscriber.email,
        subject: body.subject,
        html: body.html.includes("<html")
          ? body.html
          : layout(body.subject, `<div>${body.html}</div>`),
      });
      if (ok) sent += 1;
    }
    return c.json({ sent, total: subscribers.length });
  });
