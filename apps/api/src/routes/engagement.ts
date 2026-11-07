import { Hono } from "hono";
import { z } from "zod";
import { eq, and, desc, count, sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AppEnv } from "@/types";
import { ApiError, paginate, paginationSchema, slugify, contains } from "@/lib/http";
import { requireStaff, requireTenant, requireUser } from "@/middleware/context";
import { randomApiKey } from "@/lib/crypto";
import { layout, escapeHtml } from "@/lib/email";
import { sendBatchAsTenant } from "@/lib/mailer";
import { rateLimit, LIMITS } from "@/lib/rate-limit";

// ── Reviews ──────────────────────────────────────────────────────────────────

/** A trip's rating is the average of its published reviews only. */
export async function refreshTripRating(db: AppEnv["Variables"]["db"], activityId: number) {
  await db.run(sql`
    UPDATE ${schema.activities}
    SET average_rating = COALESCE((SELECT ROUND(AVG(${schema.reviews.rating}), 1) FROM ${schema.reviews} WHERE ${schema.reviews.activityId} = ${activityId} AND ${schema.reviews.status} = 'PUBLISHED'), 0),
        updated_at = unixepoch() * 1000
    WHERE id = ${activityId}
  `);
}

export const reviewRoutes = new Hono<AppEnv>()
  .get("/", requireTenant(), async (c) => {
    const db = c.get("db");
    const staff = c.get("staff");
    const q = paginationSchema
      .extend({
        activityId: z.coerce.number().int().optional(),
        search: z.string().trim().max(100).optional(),
        status: z.enum(["PENDING", "PUBLISHED", "HIDDEN"]).optional(),
      })
      .parse(c.req.query());
    const conditions = [eq(schema.reviews.tenantId, c.get("tenantId"))];
    // Visitors to the website only ever see published reviews. Staff see everything and can filter by status.
    if (!staff) conditions.push(eq(schema.reviews.status, "PUBLISHED"));
    else if (q.status) conditions.push(eq(schema.reviews.status, q.status));
    if (q.activityId) conditions.push(eq(schema.reviews.activityId, q.activityId));
    if (q.search) conditions.push(contains(schema.reviews.text, q.search));
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
    const data = rows.map(({ reviewerEmail, ...r }) => ({
      ...r,
      author: r.reviewerName ?? r.reviewer?.name ?? "Guest",
      // The reviewer's email is for the agency only.
      ...(staff ? { reviewerEmail } : {}),
    }));
    return c.json(paginate(data, q.page, q.limit, totalRow.value));
  })
  .post("/", requireUser(), requireTenant(), async (c) => {
    const body = z
      .object({
        activityId: z.number().int(),
        rating: z.number().int().min(1).max(5),
        text: z.string().max(5000).optional(),
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
        status: "PUBLISHED",
        source: "WEBSITE",
        publishedAt: new Date(),
      })
      .returning();

    await refreshTripRating(db, body.activityId);
    return c.json({ review }, 201);
  })
  // Moderation: staff decide what the website shows.
  .patch("/:id", requireStaff("OWNER", "ADMIN", "MANAGER"), requireTenant(), async (c) => {
    const body = z.object({ status: z.enum(["PENDING", "PUBLISHED", "HIDDEN"]) }).parse(await c.req.json());
    const db = c.get("db");
    const id = Number(c.req.param("id"));
    const current = await db.query.reviews.findFirst({
      where: and(eq(schema.reviews.id, id), eq(schema.reviews.tenantId, c.get("tenantId"))),
    });
    if (!current) throw new ApiError(404, "We couldn't find that review. It may have been deleted.");
    const [review] = await db
      .update(schema.reviews)
      .set({
        status: body.status,
        publishedAt: body.status === "PUBLISHED" ? (current.publishedAt ?? new Date()) : current.publishedAt,
        updatedAt: new Date(),
      })
      .where(eq(schema.reviews.id, id))
      .returning();
    await refreshTripRating(db, current.activityId);
    return c.json({ review });
  })
  .delete("/:id", requireTenant(), async (c) => {
    const db = c.get("db");
    const id = Number(c.req.param("id"));
    const staff = c.get("staff");
    const user = c.get("user");
    if (!staff && !user) throw new ApiError(401, "Authentication required");
    if (staff && !["OWNER", "ADMIN", "MANAGER"].includes(staff.role)) throw new ApiError(403, "Insufficient permissions");
    const deleted = await db
      .delete(schema.reviews)
      .where(
        staff
          ? and(eq(schema.reviews.id, id), eq(schema.reviews.tenantId, c.get("tenantId")))
          : and(eq(schema.reviews.id, id), eq(schema.reviews.reviewerId, user!.id)),
      )
      .returning({ id: schema.reviews.id, activityId: schema.reviews.activityId });
    if (!deleted.length) throw new ApiError(404, "We couldn't find that review. It may have been deleted.");
    await refreshTripRating(db, deleted[0].activityId);
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
    const q = paginationSchema.extend({ search: z.string().trim().max(100).optional() }).parse(c.req.query());
    const tenantId = c.get("tenantId");
    const where = and(
      eq(schema.newsletterSubscribers.tenantId, tenantId),
      q.search ? contains(schema.newsletterSubscribers.email, q.search) : undefined,
    );
    const [totalRow] = await db.select({ value: count() }).from(schema.newsletterSubscribers).where(where);
    const rows = await db.query.newsletterSubscribers.findMany({
      where,
      orderBy: [desc(schema.newsletterSubscribers.createdAt)],
      limit: q.limit,
      offset: (q.page - 1) * q.limit,
    });
    return c.json(paginate(rows, q.page, q.limit, totalRow.value));
  })
  .post("/subscribe", requireTenant(), rateLimit(LIMITS.publicForm), async (c) => {
    const body = z.object({ email: z.string().trim().email().max(200) }).parse(await c.req.json());
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
  // Linked from newsletter emails, so it answers with a page a person can read.
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
    if (c.req.header("accept")?.includes("text/html")) {
      return c.html(
        `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:system-ui,sans-serif;max-width:420px;margin:15vh auto;padding:0 24px;color:#0f172a"><h2 style="font-size:20px">You're unsubscribed</h2><p style="color:#475569">You won't get any more emails from this list.</p></body>`,
      );
    }
    return c.json({ ok: true });
  })
  // One-click unsubscribe (RFC 8058): mail clients POST here.
  .post("/unsubscribe/:secret", async (c) => {
    const db = c.get("db");
    await db
      .update(schema.newsletterSubscribers)
      .set({ isActive: false, unsubscribedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.newsletterSubscribers.unsubSecret, c.req.param("secret")));
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
    const messages = subscribers.map((subscriber) => {
      const unsubscribeUrl = `${c.env.API_BASE_URL}/api/v1/newsletter/unsubscribe/${subscriber.unsubSecret}`;
      const footer = `<p style="color:#64748b;font-size:12px;margin-top:24px"><a href="${unsubscribeUrl}" style="color:#64748b">Unsubscribe</a></p>`;
      const html = body.html.includes("</body>")
        ? body.html.replace("</body>", `${footer}</body>`)
        : layout(escapeHtml(body.subject), `<div>${body.html}</div>${footer}`);
      return {
        to: subscriber.email,
        subject: body.subject,
        html,
        headers: {
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      };
    });
    const sent = await sendBatchAsTenant(c.env, db, tenantId, messages);
    return c.json({ sent, total: subscribers.length });
  });
