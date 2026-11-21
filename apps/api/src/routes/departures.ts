import { Hono } from "hono";
import { z } from "zod";
import { eq, and, asc, count, inArray, gte, lte } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AppEnv } from "@/types";
import { ApiError, paginate, paginationSchema, contains } from "@/lib/http";
import { requireStaff, requireTenant } from "@/middleware/context";
import { rateLimit, LIMITS } from "@/lib/rate-limit";
import { notifyOwner } from "@/lib/notify";
import { isIsoDate } from "@/lib/dates";

const isoDate = z.string().refine(isIsoDate, "must be a date like 2026-09-14");

/** OPEN and FULL follow the seats left; DELAYED is the only manual status. */
function statusFor(seatsLeft: number, requested?: "OPEN" | "FULL" | "DELAYED") {
  if (requested === "DELAYED") return "DELAYED" as const;
  if (requested === "FULL") return "FULL" as const;
  return seatsLeft <= 0 ? ("FULL" as const) : ("OPEN" as const);
}

const departureSchema = z
  .object({
    activityId: z.number().int(),
    startDate: isoDate,
    endDate: isoDate.nullable().optional(),
    capacity: z.number().int().min(0).max(10_000),
    /** Seats still free. Defaults to the full capacity. */
    seatsLeft: z.number().int().min(0).max(10_000).optional(),
    price: z.number().nonnegative(),
    status: z.enum(["OPEN", "FULL", "DELAYED"]).optional(),
  })
  .refine((d) => !d.endDate || d.endDate >= d.startDate, {
    path: ["endDate"],
    message: "can't be before the start date",
  })
  .refine((d) => d.seatsLeft === undefined || d.seatsLeft <= d.capacity, {
    path: ["seatsLeft"],
    message: "can't be more than the capacity",
  });

/**
 * Departure dates for trips. Wepilo doesn't take bookings: the agency keeps the seats-left
 * number up to date itself, and travellers ask about a date through the enquiry form.
 */
export const departureRoutes = new Hono<AppEnv>()
  .get("/", requireTenant(), async (c) => {
    const db = c.get("db");
    const q = paginationSchema
      .extend({
        activityId: z.coerce.number().int().optional(),
        status: z.enum(["OPEN", "FULL", "DELAYED"]).optional(),
        /** Only departures starting on or after this date. */
        from: isoDate.optional(),
        /** Only departures starting on or before this date. */
        to: isoDate.optional(),
        /** Matches the trip's title. */
        search: z.string().trim().max(100).optional(),
      })
      .parse(c.req.query());
    const D = schema.departures;
    const conditions = [eq(D.tenantId, c.get("tenantId"))];
    if (q.search) {
      conditions.push(
        inArray(
          D.activityId,
          db
            .select({ id: schema.activities.id })
            .from(schema.activities)
            .where(and(eq(schema.activities.tenantId, c.get("tenantId")), contains(schema.activities.title, q.search))),
        ),
      );
    }
    if (q.activityId) conditions.push(eq(D.activityId, q.activityId));
    if (q.status) conditions.push(eq(D.status, q.status));
    if (q.from) conditions.push(gte(D.startDate, q.from));
    if (q.to) conditions.push(lte(D.startDate, q.to));

    const [totalRow] = await db.select({ value: count() }).from(D).where(and(...conditions));

    const rows = await db.query.departures.findMany({
      where: and(...conditions),
      with: { activity: { columns: { id: true, title: true, slug: true } } },
      orderBy: [asc(D.startDate)],
      limit: q.limit,
      offset: (q.page - 1) * q.limit,
    });
    return c.json(paginate(rows, q.page, q.limit, totalRow.value));
  })
  .post("/", requireStaff("OWNER", "ADMIN", "MANAGER"), requireTenant(), async (c) => {
    const body = departureSchema.parse(await c.req.json());
    const db = c.get("db");
    const tenantId = c.get("tenantId");
    const activity = await db.query.activities.findFirst({
      where: and(eq(schema.activities.id, body.activityId), eq(schema.activities.tenantId, tenantId)),
    });
    if (!activity) throw new ApiError(404, "Activity not found");

    const seatsLeft = body.seatsLeft ?? body.capacity;
    const [row] = await db
      .insert(schema.departures)
      .values({
        tenantId,
        activityId: body.activityId,
        startDate: body.startDate,
        endDate: body.endDate ?? null,
        capacity: body.capacity,
        availableSpots: seatsLeft,
        price: body.price,
        status: statusFor(seatsLeft, body.status),
      })
      .returning();
    return c.json({ departure: row }, 201);
  })
  .patch("/:id", requireStaff("OWNER", "ADMIN", "MANAGER"), requireTenant(), async (c) => {
    const body = z
      .object({
        startDate: isoDate,
        endDate: isoDate.nullable(),
        capacity: z.number().int().min(0).max(10_000),
        seatsLeft: z.number().int().min(0).max(10_000),
        price: z.number().nonnegative(),
        status: z.enum(["OPEN", "FULL", "DELAYED"]),
      })
      .partial()
      .parse(await c.req.json());
    const db = c.get("db");
    const tenantId = c.get("tenantId");
    const id = Number(c.req.param("id"));
    const D = schema.departures;

    const current = await db.query.departures.findFirst({ where: and(eq(D.id, id), eq(D.tenantId, tenantId)) });
    if (!current) throw new ApiError(404, "Departure not found");
    const start = body.startDate ?? current.startDate;
    const end = body.endDate === undefined ? current.endDate : body.endDate;
    if (end && end < start) throw new ApiError(400, "endDate: can't be before the start date", "VALIDATION");

    const capacity = body.capacity ?? current.capacity;
    // A smaller capacity can't leave more seats free than there are seats.
    const seatsLeft = Math.min(body.seatsLeft ?? current.availableSpots, capacity);
    if (body.seatsLeft !== undefined && body.seatsLeft > capacity) {
      throw new ApiError(400, "seatsLeft: can't be more than the capacity", "VALIDATION");
    }
    const keepDelayed = body.status === undefined && current.status === "DELAYED";

    const [row] = await db
      .update(D)
      .set({
        updatedAt: new Date(),
        ...(body.startDate !== undefined ? { startDate: body.startDate } : {}),
        ...(body.endDate !== undefined ? { endDate: body.endDate } : {}),
        ...(body.price !== undefined ? { price: body.price } : {}),
        capacity,
        availableSpots: seatsLeft,
        status: keepDelayed ? "DELAYED" : statusFor(seatsLeft, body.status),
      })
      .where(and(eq(D.id, id), eq(D.tenantId, tenantId)))
      .returning();
    return c.json({ departure: row });
  })
  .patch("/:id/delay", requireStaff("OWNER", "ADMIN", "MANAGER"), requireTenant(), async (c) => {
    const db = c.get("db");
    const [row] = await db
      .update(schema.departures)
      .set({ status: "DELAYED", updatedAt: new Date() })
      .where(and(eq(schema.departures.id, Number(c.req.param("id"))), eq(schema.departures.tenantId, c.get("tenantId"))))
      .returning();
    if (!row) throw new ApiError(404, "Departure not found");
    return c.json({ departure: row });
  })
  .delete("/:id", requireStaff("OWNER", "ADMIN"), requireTenant(), async (c) => {
    const db = c.get("db");
    const [row] = await db
      .delete(schema.departures)
      .where(and(eq(schema.departures.id, Number(c.req.param("id"))), eq(schema.departures.tenantId, c.get("tenantId"))))
      .returning({ id: schema.departures.id });
    if (!row) throw new ApiError(404, "Departure not found");
    return c.json({ ok: true });
  });

// ── Enquiries ────────────────────────────────────────────────────────────────

/**
 * The website's contact and trip forms. Wepilo doesn't keep an inbox: each enquiry is emailed
 * straight to the agency's alert addresses (Settings › Email) with the traveller as reply-to,
 * so the team answers from the email or WhatsApp it already uses. Nothing is stored.
 */
export const inquiryRoutes = new Hono<AppEnv>().post("/", requireTenant(), rateLimit(LIMITS.publicForm), async (c) => {
  const body = z
    .object({
      name: z.string().trim().min(1).max(120),
      email: z.string().trim().email().max(200),
      phone: z.string().trim().max(40).optional(),
      trip: z.string().trim().max(200).optional(),
      /** The departure date the traveller is asking about, if any. */
      departureDate: isoDate.optional(),
      travellers: z.number().int().min(1).max(200).optional(),
      message: z.string().trim().min(1).max(5000),
    })
    .parse(await c.req.json());
  notifyOwner(c, {
    subject: body.trip ? `New enquiry: ${body.trip}` : `New enquiry from ${body.name}`,
    heading: body.departureDate ? "New enquiry about a departure" : "New enquiry",
    replyTo: body.email,
    fields: [
      ["Name", body.name],
      ["Email", body.email],
      ["Phone", body.phone],
      ["Trip", body.trip],
      ["Departure", body.departureDate],
      ["Travellers", body.travellers ? String(body.travellers) : undefined],
      ["Message", body.message],
    ],
  });
  return c.json({ ok: true }, 202);
});

