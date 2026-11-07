import { Hono } from "hono";
import { z } from "zod";
import { and, desc, eq, gt } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AppEnv } from "@/types";
import { ApiError } from "@/lib/http";
import { requireStaff, requireTenant } from "@/middleware/context";
import { clientIp, enforce, LIMITS } from "@/lib/rate-limit";
import { putObject } from "@/lib/storage";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_PHOTOS = 5;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const PHOTO_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

const newToken = () => `rv_${crypto.randomUUID().replace(/-/g, "")}${crypto.randomUUID().replace(/-/g, "")}`;

const linkUrl = (env: AppEnv["Bindings"], token: string) => `${env.DASHBOARD_URL}/review/${token}`;

// ── For agency staff: create and manage review links ─────────────────────────

export const reviewLinkRoutes = new Hono<AppEnv>()
  .get("/", requireStaff(), requireTenant(), async (c) => {
    const db = c.get("db");
    const rows = await db.query.reviewLinks.findMany({
      where: and(eq(schema.reviewLinks.tenantId, c.get("tenantId")), gt(schema.reviewLinks.expiresAt, new Date())),
      with: { activity: { columns: { id: true, title: true } } },
      orderBy: [desc(schema.reviewLinks.createdAt)],
      limit: 20,
    });
    return c.json({ data: rows.map((l) => ({ id: l.id, token: l.token, url: linkUrl(c.env, l.token), expiresAt: l.expiresAt, activity: l.activity })) });
  })
  .post("/", requireStaff("OWNER", "ADMIN", "MANAGER"), requireTenant(), async (c) => {
    const body = z
      .object({
        activityId: z.number({ required_error: "Choose a trip." }).int(),
        expiresInDays: z.number().int().min(1).max(365).default(30),
      })
      .parse(await c.req.json());
    const db = c.get("db");
    const tenantId = c.get("tenantId");
    const activity = await db.query.activities.findFirst({
      where: and(eq(schema.activities.id, body.activityId), eq(schema.activities.tenantId, tenantId)),
      columns: { id: true, title: true },
    });
    if (!activity) throw new ApiError(404, "We couldn't find that trip. It may have been deleted.");
    const token = newToken();
    const expiresAt = new Date(Date.now() + body.expiresInDays * DAY_MS);
    const [link] = await db
      .insert(schema.reviewLinks)
      .values({ tenantId, activityId: activity.id, token, expiresAt, createdById: c.get("staff")!.id })
      .returning();
    return c.json({ link: { id: link.id, token, url: linkUrl(c.env, token), expiresAt, activity } }, 201);
  })
  // Revoking ends the link right away.
  .delete("/:id", requireStaff("OWNER", "ADMIN", "MANAGER"), requireTenant(), async (c) => {
    const db = c.get("db");
    const [row] = await db
      .update(schema.reviewLinks)
      .set({ expiresAt: new Date(), updatedAt: new Date() })
      .where(and(eq(schema.reviewLinks.id, Number(c.req.param("id"))), eq(schema.reviewLinks.tenantId, c.get("tenantId"))))
      .returning({ id: schema.reviewLinks.id });
    if (!row) throw new ApiError(404, "We couldn't find that link.");
    return c.json({ ok: true });
  });

// ── For the traveller: no sign-in, the link itself is the key ────────────────

async function findLink(c: { get: (k: "db") => AppEnv["Variables"]["db"] }, token: string) {
  const db = c.get("db");
  const link = await db.query.reviewLinks.findFirst({
    where: eq(schema.reviewLinks.token, token),
    with: { activity: { columns: { id: true, title: true, images: true } }, tenant: { columns: { id: true, status: true, companyName: true, companyLogo: true } } },
  });
  if (!link || !link.activity || !link.tenant || link.tenant.status !== "ACTIVE") {
    throw new ApiError(404, "This review link isn't valid. Please ask the team that sent it for a new one.", "LINK_INVALID");
  }
  if (link.expiresAt.getTime() <= Date.now()) {
    throw new ApiError(410, "This review link has expired. Please ask the team that sent it for a new one.", "LINK_EXPIRED");
  }
  return link;
}

export const publicReviewRoutes = new Hono<AppEnv>()
  .get("/:token", async (c) => {
    const link = await findLink(c, c.req.param("token"));
    const images = Array.isArray(link.activity!.images) ? (link.activity!.images as string[]) : [];
    return c.json({
      business: { name: link.tenant!.companyName, logo: link.tenant!.companyLogo },
      trip: { title: link.activity!.title, image: images[0] ?? null },
      expiresAt: link.expiresAt,
    });
  })
  .post("/:token/photos", async (c) => {
    const db = c.get("db");
    const token = c.req.param("token");
    const link = await findLink(c, token);
    await enforce(db, { name: "review-photo", max: 30, windowSeconds: 10 * 60 }, `${token}:${clientIp(c)}`);
    const form = await c.req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "Choose a photo to upload.");
    const ext = PHOTO_TYPES[file.type];
    if (!ext) throw new ApiError(415, "Please upload a JPG, PNG or WebP photo.");
    if (file.size > MAX_PHOTO_BYTES) throw new ApiError(413, "That photo is too large. Please choose one under 8 MB.");
    const key = `tenants/${link.tenantId}/reviews/${crypto.randomUUID()}.${ext}`;
    const stored = await putObject(c.env, key, await file.arrayBuffer(), file.type);
    return c.json({ url: stored.url }, 201);
  })
  .post("/:token/reviews", async (c) => {
    const db = c.get("db");
    const token = c.req.param("token");
    const link = await findLink(c, token);
    await enforce(db, LIMITS.publicForm, `${token}:${clientIp(c)}`);
    const body = z
      .object({
        name: z.string().trim().min(1).max(80),
        email: z.union([z.string().trim().email().max(200), z.literal("")]).optional(),
        rating: z.number({ required_error: "Choose a star rating." }).int().min(1, "Choose a star rating.").max(5),
        title: z.string().trim().max(120).optional(),
        text: z.string().trim().min(10, "Please write at least a sentence or two.").max(5000),
        images: z.array(z.string().url()).max(MAX_PHOTOS).default([]),
      })
      .parse(await c.req.json());

    // Only photos uploaded through this page, for this agency, can be attached.
    const allowed = `${c.env.API_BASE_URL}/media/file/tenants/${link.tenantId}/reviews/`;
    const images = body.images.filter((u) => u.startsWith(allowed));

    const email = body.email ? body.email.toLowerCase() : null;
    if (email) {
      const dupe = await db.query.reviews.findFirst({
        where: and(eq(schema.reviews.activityId, link.activityId), eq(schema.reviews.reviewerEmail, email), eq(schema.reviews.source, "LINK")),
        columns: { id: true },
      });
      if (dupe) throw new ApiError(409, "It looks like you've already shared a review of this trip. Thank you!");
    }

    await db.insert(schema.reviews).values({
      tenantId: link.tenantId,
      activityId: link.activityId,
      reviewerName: body.name,
      reviewerEmail: email,
      rating: body.rating,
      title: body.title || null,
      text: body.text,
      images,
      status: "PENDING",
      source: "LINK",
    });
    // Nothing is published until the agency approves it, so the trip's rating does not change yet.
    return c.json({ ok: true }, 201);
  });
