import { Hono } from "hono";
import { z } from "zod";
import { eq, and, or, desc, asc, count, sql, inArray } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AppEnv } from "@/types";
import { ApiError, paginate, paginationSchema, contains } from "@/lib/http";
import { requireStaff, requireTenant } from "@/middleware/context";
import { rateLimit, LIMITS } from "@/lib/rate-limit";
import { notifyOwner } from "@/lib/notify";
import { isIsoDate, extrasTotal } from "@/lib/bookings";
import { getSettings } from "@/lib/payments";
import { randomApiKey } from "@/lib/crypto";
import { applyBookingStatus } from "@/lib/booking-actions";

const isoDate = z.string().refine(isIsoDate, "must be a date like 2026-09-14");

const departureSchema = z
  .object({
    activityId: z.number().int(),
    startDate: isoDate,
    endDate: isoDate.nullable().optional(),
    capacity: z.number().int().min(0).max(10_000),
    price: z.number().nonnegative(),
    status: z.enum(["OPEN", "FULL", "DELAYED"]).optional(),
  })
  .refine((d) => !d.endDate || d.endDate >= d.startDate, {
    path: ["endDate"],
    message: "can't be before the start date",
  });

export const departureRoutes = new Hono<AppEnv>()
  .get("/", requireTenant(), async (c) => {
    const db = c.get("db");
    const q = paginationSchema
      .extend({
        activityId: z.coerce.number().int().optional(),
        status: z.enum(["OPEN", "FULL", "DELAYED"]).optional(),
        /** Matches the trip's title. */
        search: z.string().trim().max(100).optional(),
      })
      .parse(c.req.query());
    const conditions = [eq(schema.departures.tenantId, c.get("tenantId"))];
    if (q.search) {
      conditions.push(
        inArray(
          schema.departures.activityId,
          db
            .select({ id: schema.activities.id })
            .from(schema.activities)
            .where(and(eq(schema.activities.tenantId, c.get("tenantId")), contains(schema.activities.title, q.search))),
        ),
      );
    }
    if (q.activityId) conditions.push(eq(schema.departures.activityId, q.activityId));
    if (q.status) conditions.push(eq(schema.departures.status, q.status));

    const [totalRow] = await db
      .select({ value: count() })
      .from(schema.departures)
      .where(and(...conditions));

    const rows = await db.query.departures.findMany({
      where: and(...conditions),
      with: { activity: { columns: { id: true, title: true, slug: true } } },
      orderBy: [asc(schema.departures.startDate)],
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

    const [row] = await db
      .insert(schema.departures)
      .values({
        tenantId,
        activityId: body.activityId,
        startDate: body.startDate,
        endDate: body.endDate ?? null,
        capacity: body.capacity,
        availableSpots: body.capacity,
        price: body.price,
        status: body.status === "DELAYED" ? "DELAYED" : body.capacity === 0 ? "FULL" : "OPEN",
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
        price: z.number().nonnegative(),
        status: z.enum(["OPEN", "FULL", "DELAYED"]),
      })
      .partial()
      .parse(await c.req.json());
    const db = c.get("db");
    const tenantId = c.get("tenantId");
    const id = Number(c.req.param("id"));
    const D = schema.departures;

    const current = await db.query.departures.findFirst({
      where: and(eq(D.id, id), eq(D.tenantId, tenantId)),
    });
    if (!current) throw new ApiError(404, "Departure not found");
    const start = body.startDate ?? current.startDate;
    const end = body.endDate === undefined ? current.endDate : body.endDate;
    if (end && end < start) throw new ApiError(400, "endDate: can't be before the start date", "VALIDATION");

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (body.startDate !== undefined) patch.startDate = body.startDate;
    if (body.endDate !== undefined) patch.endDate = body.endDate;
    if (body.price !== undefined) patch.price = body.price;

    const conditions = [eq(D.id, id), eq(D.tenantId, tenantId)];
    if (body.capacity !== undefined) {
      // Seats already held stay held: moving capacity moves free spots by the same amount.
      patch.capacity = body.capacity;
      patch.availableSpots = sql`${D.availableSpots} + ${body.capacity} - ${D.capacity}`;
      conditions.push(sql`${D.availableSpots} + ${body.capacity} - ${D.capacity} >= 0`);
    }
    // OPEN and FULL are worked out from the free seats; only DELAYED is a manual choice.
    const freeSeats =
      body.capacity !== undefined ? sql`${D.availableSpots} + ${body.capacity} - ${D.capacity}` : sql`${D.availableSpots}`;
    if (body.status === "DELAYED") {
      patch.status = "DELAYED";
    } else if (body.status !== undefined || body.capacity !== undefined) {
      patch.status = sql`CASE WHEN ${body.status === undefined ? sql`${D.status} = 'DELAYED'` : sql`0`} THEN 'DELAYED'
        WHEN ${freeSeats} <= 0 THEN 'FULL' ELSE 'OPEN' END`;
    }

    const [row] = await db.update(D).set(patch).where(and(...conditions)).returning();
    if (!row) {
      throw new ApiError(
        409,
        "Capacity can't go below the seats already confirmed on this departure.",
        "CAPACITY_BELOW_BOOKED",
      );
    }
    return c.json({ departure: row });
  })
  .patch("/:id/delay", requireStaff("OWNER", "ADMIN", "MANAGER"), requireTenant(), async (c) => {
    const db = c.get("db");
    const [row] = await db
      .update(schema.departures)
      .set({ status: "DELAYED", updatedAt: new Date() })
      .where(
        and(
          eq(schema.departures.id, Number(c.req.param("id"))),
          eq(schema.departures.tenantId, c.get("tenantId")),
        ),
      )
      .returning();
    if (!row) throw new ApiError(404, "Departure not found");
    return c.json({ departure: row });
  })
  .delete("/:id", requireStaff("OWNER", "ADMIN"), requireTenant(), async (c) => {
    const db = c.get("db");
    const id = Number(c.req.param("id"));
    const tenantId = c.get("tenantId");
    // Bookings cascade with their departure, so refuse while any are still live.
    const [live] = await db
      .select({ value: count() })
      .from(schema.bookings)
      .where(
        and(
          eq(schema.bookings.departureId, id),
          eq(schema.bookings.tenantId, tenantId),
          sql`${schema.bookings.status} IN ('PENDING', 'CONFIRMED')`,
        ),
      );
    if (live.value > 0) {
      throw new ApiError(
        409,
        `This departure has ${live.value} active booking${live.value === 1 ? "" : "s"}. Cancel them first.`,
        "DEPARTURE_HAS_BOOKINGS",
      );
    }
    await db
      .delete(schema.departures)
      .where(and(eq(schema.departures.id, id), eq(schema.departures.tenantId, tenantId)));
    return c.json({ ok: true });
  });

// ── Bookings ─────────────────────────────────────────────────────────────────

export const bookingRoutes = new Hono<AppEnv>()
  .get("/", requireStaff(), requireTenant(), async (c) => {
    const db = c.get("db");
    const q = paginationSchema
      .extend({
        status: z.enum(["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"]).optional(),
        activityId: z.coerce.number().int().optional(),
        search: z.string().optional(),
      })
      .parse(c.req.query());
    const conditions = [eq(schema.bookings.tenantId, c.get("tenantId"))];
    if (q.status) conditions.push(eq(schema.bookings.status, q.status));
    if (q.activityId) conditions.push(eq(schema.bookings.activityId, q.activityId));
    if (q.search) {
      conditions.push(
        or(contains(schema.bookings.name, q.search), contains(schema.bookings.email, q.search))!,
      );
    }

    const [totalRow] = await db
      .select({ value: count() })
      .from(schema.bookings)
      .where(and(...conditions));

    const rows = await db.query.bookings.findMany({
      where: and(...conditions),
      columns: { publicToken: false },
      extras: (_b, { sql }) => ({
        paidMinor: sql<number>`(SELECT COALESCE(SUM(amount_minor), 0) FROM payments WHERE payments.booking_id = "bookings"."id" AND payments.status = 'PAID')`.as("paid_minor"),
      }),
      with: {
        activity: { columns: { id: true, title: true, slug: true } },
        departure: { columns: { id: true, startDate: true, endDate: true, price: true } },
      },
      orderBy: [desc(schema.bookings.createdAt)],
      limit: q.limit,
      offset: (q.page - 1) * q.limit,
    });
    return c.json(paginate(rows, q.page, q.limit, totalRow.value));
  })
  .get("/:id", requireStaff(), requireTenant(), async (c) => {
    const db = c.get("db");
    const row = await db.query.bookings.findFirst({
      where: and(
        eq(schema.bookings.id, Number(c.req.param("id"))),
        eq(schema.bookings.tenantId, c.get("tenantId")),
      ),
      columns: { publicToken: false },
      extras: (_b, { sql }) => ({
        paidMinor: sql<number>`(SELECT COALESCE(SUM(amount_minor), 0) FROM payments WHERE payments.booking_id = "bookings"."id" AND payments.status = 'PAID')`.as("paid_minor"),
      }),
      with: {
        activity: true,
        departure: true,
        payments: { orderBy: (p, { desc }) => [desc(p.createdAt)] },
      },
    });
    if (!row) throw new ApiError(404, "Booking not found");
    return c.json({ booking: row });
  })
  .post("/", requireTenant(), rateLimit(LIMITS.publicForm), async (c) => {
    const body = z
      .object({
        activityId: z.number().int(),
        departureId: z.number().int(),
        groupSize: z.number().int().min(1).max(200).default(1),
        name: z.string().trim().min(1).max(120),
        email: z.string().trim().email().max(200),
        phone: z.string().trim().min(1).max(40),
        extraIds: z.array(z.number().int()).max(50).optional(),
      })
      .parse(await c.req.json());
    const db = c.get("db");
    const tenantId = c.get("tenantId");

    const activity = await db.query.activities.findFirst({
      where: and(
        eq(schema.activities.id, body.activityId),
        eq(schema.activities.tenantId, tenantId),
        eq(schema.activities.status, "PUBLISHED"),
      ),
    });
    if (!activity) throw new ApiError(404, "Activity not found");

    const departure = await db.query.departures.findFirst({
      where: and(
        eq(schema.departures.id, body.departureId),
        eq(schema.departures.tenantId, tenantId),
        eq(schema.departures.activityId, body.activityId),
      ),
    });
    if (!departure) throw new ApiError(404, "Departure not found");
    if (departure.status === "FULL" || departure.status === "DELAYED") {
      throw new ApiError(409, "Departure is not open for booking", "DEPARTURE_CLOSED");
    }
    if (departure.startDate < new Date().toISOString().slice(0, 10)) {
      throw new ApiError(409, "This departure has already started", "DEPARTURE_CLOSED");
    }
    if (departure.availableSpots < body.groupSize) {
      throw new ApiError(409, "Not enough spots available", "NOT_ENOUGH_SPOTS");
    }

    // Extras must be offered on this trip; an unknown id is an error, not a silent free pass.
    const extraIds = [...new Set(body.extraIds ?? [])];
    const extras = extraIds.length
      ? await db
          .select({ id: schema.extras.id, price: schema.extras.price })
          .from(schema.activityExtras)
          .innerJoin(schema.extras, eq(schema.extras.id, schema.activityExtras.extraId))
          .where(
            and(
              eq(schema.activityExtras.activityId, body.activityId),
              eq(schema.extras.tenantId, tenantId),
              sql`${schema.extras.id} IN (${sql.join(extraIds.map((id) => sql`${id}`), sql`, `)})`,
            ),
          )
      : [];
    if (extras.length !== extraIds.length) {
      throw new ApiError(400, "extraIds: one or more extras aren't offered on this trip", "VALIDATION");
    }
    const totalPrice = departure.price * body.groupSize + extrasTotal(extras, body.groupSize);

    const [booking] = await db
      .insert(schema.bookings)
      .values({
        tenantId,
        activityId: body.activityId,
        departureId: body.departureId,
        groupSize: body.groupSize,
        totalPrice,
        status: "PENDING",
        name: body.name,
        email: body.email,
        phone: body.phone,
        extraIds,
        currency: (await getSettings(db, tenantId))?.currency ?? "USD",
        publicToken: randomApiKey().replace("wepilo_", "bk_"),
      })
      .returning();

    notifyOwner(c, {
      subject: `New booking request: ${activity.title}`,
      heading: "New booking request",
      replyTo: body.email,
      path: `/bookings`,
      fields: [
        ["Trip", activity.title],
        ["Departure", departure.startDate],
        ["Travellers", String(body.groupSize)],
        ["Total", String(totalPrice)],
        ["Name", body.name],
        ["Email", body.email],
        ["Phone", body.phone],
      ],
    });

    return c.json({ booking }, 201);
  })
  .patch("/:id/status", requireStaff("OWNER", "ADMIN", "MANAGER"), requireTenant(), async (c) => {
    const body = z
      .object({ status: z.enum(["CONFIRMED", "CANCELLED", "COMPLETED"]) })
      .parse(await c.req.json());
    const updated = await applyBookingStatus(c.get("db"), c.get("tenantId"), Number(c.req.param("id")), body.status);
    return c.json({ booking: updated });
  });

// ── Inquiries ────────────────────────────────────────────────────────────────

export const inquiryRoutes = new Hono<AppEnv>()
  .get("/", requireStaff(), requireTenant(), async (c) => {
    const db = c.get("db");
    const q = paginationSchema
      .extend({ status: z.enum(["NEW", "IN_PROGRESS", "RESOLVED", "CLOSED"]).optional(), search: z.string().trim().max(100).optional() })
      .parse(c.req.query());
    const conditions = [eq(schema.inquiries.tenantId, c.get("tenantId"))];
    if (q.status) conditions.push(eq(schema.inquiries.status, q.status));
    if (q.search) {
      conditions.push(
        or(contains(schema.inquiries.name, q.search), contains(schema.inquiries.email, q.search), contains(schema.inquiries.trip, q.search))!,
      );
    }
    const [totalRow] = await db
      .select({ value: count() })
      .from(schema.inquiries)
      .where(and(...conditions));
    const rows = await db.query.inquiries.findMany({
      where: and(...conditions),
      orderBy: [desc(schema.inquiries.createdAt)],
      limit: q.limit,
      offset: (q.page - 1) * q.limit,
    });
    return c.json(paginate(rows, q.page, q.limit, totalRow.value));
  })
  .post("/", requireTenant(), rateLimit(LIMITS.publicForm), async (c) => {
    const body = z
      .object({
        name: z.string().trim().min(1).max(120),
        email: z.string().trim().email().max(200),
        phone: z.string().trim().max(40).optional(),
        trip: z.string().trim().max(200).optional(),
        message: z.string().trim().min(1).max(5000),
      })
      .parse(await c.req.json());
    const db = c.get("db");
    const [row] = await db
      .insert(schema.inquiries)
      .values({
        tenantId: c.get("tenantId"),
        name: body.name,
        email: body.email,
        phone: body.phone || null,
        trip: body.trip || null,
        message: body.message,
      })
      .returning();
    notifyOwner(c, {
      subject: `New inquiry from ${body.name}`,
      heading: "New inquiry",
      replyTo: body.email,
      path: `/inquiries`,
      fields: [
        ["Name", body.name],
        ["Email", body.email],
        ["Phone", body.phone],
        ["Trip", body.trip],
        ["Message", body.message],
      ],
    });
    return c.json({ inquiry: row }, 201);
  })
  .patch("/:id/status", requireStaff(), requireTenant(), async (c) => {
    const body = z
      .object({ status: z.enum(["NEW", "IN_PROGRESS", "RESOLVED", "CLOSED"]) })
      .parse(await c.req.json());
    const db = c.get("db");
    const [row] = await db
      .update(schema.inquiries)
      .set({ status: body.status, updatedAt: new Date() })
      .where(
        and(
          eq(schema.inquiries.id, Number(c.req.param("id"))),
          eq(schema.inquiries.tenantId, c.get("tenantId")),
        ),
      )
      .returning();
    if (!row) throw new ApiError(404, "Inquiry not found");
    return c.json({ inquiry: row });
  });
