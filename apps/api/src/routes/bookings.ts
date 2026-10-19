import { Hono } from "hono";
import { z } from "zod";
import { eq, and, desc, asc, count, sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AppEnv } from "@/types";
import { ApiError, paginate, paginationSchema } from "@/lib/http";
import { requireStaff, requireTenant } from "@/middleware/context";

const departureSchema = z.object({
  activityId: z.number().int(),
  startDate: z.string().min(1),
  endDate: z.string().nullable().optional(),
  capacity: z.number().int().min(0),
  price: z.number().nonnegative(),
  status: z.enum(["OPEN", "FULL", "DELAYED"]).optional(),
});

export const departureRoutes = new Hono<AppEnv>()
  .get("/", requireTenant(), async (c) => {
    const db = c.get("db");
    const q = paginationSchema
      .extend({
        activityId: z.coerce.number().int().optional(),
        status: z.enum(["OPEN", "FULL", "DELAYED"]).optional(),
      })
      .parse(c.req.query());
    const conditions = [eq(schema.departures.tenantId, c.get("tenantId"))];
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
        status: body.status ?? "OPEN",
      })
      .returning();
    return c.json({ departure: row }, 201);
  })
  .patch("/:id", requireStaff("OWNER", "ADMIN", "MANAGER"), requireTenant(), async (c) => {
    const body = departureSchema.partial().omit({ activityId: true }).parse(await c.req.json());
    const db = c.get("db");
    const [row] = await db
      .update(schema.departures)
      .set({ ...body, updatedAt: new Date() })
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
    await db
      .delete(schema.departures)
      .where(
        and(
          eq(schema.departures.id, Number(c.req.param("id"))),
          eq(schema.departures.tenantId, c.get("tenantId")),
        ),
      );
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
        sql`(${schema.bookings.name} LIKE ${`%${q.search}%`} OR ${schema.bookings.email} LIKE ${`%${q.search}%`})`,
      );
    }

    const [totalRow] = await db
      .select({ value: count() })
      .from(schema.bookings)
      .where(and(...conditions));

    const rows = await db.query.bookings.findMany({
      where: and(...conditions),
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
      with: {
        activity: true,
        departure: true,
      },
    });
    if (!row) throw new ApiError(404, "Booking not found");
    return c.json({ booking: row });
  })
  .post("/", requireTenant(), async (c) => {
    const body = z
      .object({
        activityId: z.number().int(),
        departureId: z.number().int(),
        groupSize: z.number().int().min(1).default(1),
        name: z.string().min(1),
        email: z.string().email(),
        phone: z.string().min(1),
        extraIds: z.array(z.number().int()).optional(),
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
    if (departure.availableSpots < body.groupSize) {
      throw new ApiError(409, "Not enough spots available", "NOT_ENOUGH_SPOTS");
    }

    const extras = body.extraIds?.length
      ? await db.query.extras.findMany({
          where: and(
            eq(schema.extras.tenantId, tenantId),
            sql`${schema.extras.id} IN (${sql.join(body.extraIds.map((id) => sql`${id}`), sql`, `)})`,
          ),
        })
      : [];
    const extraTotal = extras.reduce(
      (sum, extra) => sum + (extra.price && extra.price > 0 ? extra.price * body.groupSize : 0),
      0,
    );
    const totalPrice = departure.price * body.groupSize + extraTotal;

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
        extraIds: body.extraIds ?? [],
      })
      .returning();

    return c.json({ booking }, 201);
  })
  .patch("/:id/status", requireStaff("OWNER", "ADMIN", "MANAGER"), requireTenant(), async (c) => {
    const body = z
      .object({ status: z.enum(["CONFIRMED", "CANCELLED", "COMPLETED"]) })
      .parse(await c.req.json());
    const db = c.get("db");
    const tenantId = c.get("tenantId");
    const bookingId = Number(c.req.param("id"));

    const booking = await db.query.bookings.findFirst({
      where: and(eq(schema.bookings.id, bookingId), eq(schema.bookings.tenantId, tenantId)),
    });
    if (!booking) throw new ApiError(404, "Booking not found");

    const seatsToRelease = body.status === "CANCELLED" ? booking.groupSize : 0;
    const seatsToHold = booking.status === "PENDING" && body.status === "CONFIRMED" ? booking.groupSize : 0;

    if (seatsToHold > 0) {
      const result = await db.run(sql`
        UPDATE ${schema.departures}
        SET available_spots = available_spots - ${seatsToHold},
            updated_at = unixepoch() * 1000
        WHERE id = ${booking.departureId} AND available_spots >= ${seatsToHold}
      `);
      if (result.meta.changes === 0) {
        throw new ApiError(409, "Not enough spots available", "NOT_ENOUGH_SPOTS");
      }
    } else if (seatsToRelease > 0 && (booking.status === "CONFIRMED" || booking.status === "PENDING")) {
      await db.run(sql`
        UPDATE ${schema.departures}
        SET available_spots = MIN(capacity, available_spots + ${seatsToRelease}),
            updated_at = unixepoch() * 1000
        WHERE id = ${booking.departureId}
      `);
    }

    const [updated] = await db
      .update(schema.bookings)
      .set({ status: body.status, updatedAt: new Date() })
      .where(eq(schema.bookings.id, bookingId))
      .returning();

    if (body.status === "CONFIRMED") {
      await db
        .update(schema.activities)
        .set({ bookingsCount: sql`${schema.activities.bookingsCount} + 1` })
        .where(eq(schema.activities.id, booking.activityId));
    }

    return c.json({ booking: updated });
  });

// ── Inquiries ────────────────────────────────────────────────────────────────

export const inquiryRoutes = new Hono<AppEnv>()
  .get("/", requireStaff(), requireTenant(), async (c) => {
    const db = c.get("db");
    const q = paginationSchema
      .extend({ status: z.enum(["NEW", "IN_PROGRESS", "RESOLVED", "CLOSED"]).optional() })
      .parse(c.req.query());
    const conditions = [eq(schema.inquiries.tenantId, c.get("tenantId"))];
    if (q.status) conditions.push(eq(schema.inquiries.status, q.status));
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
  .post("/", requireTenant(), async (c) => {
    const body = z
      .object({
        name: z.string().min(1),
        email: z.string().email(),
        phone: z.string().optional(),
        trip: z.string().optional(),
        message: z.string().min(1),
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
