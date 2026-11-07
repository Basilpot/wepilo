import { and, eq, sql } from "drizzle-orm";
import type { Db } from "@/db";
import * as schema from "@/db/schema";
import { ApiError } from "@/lib/http";
import { canTransition, seatDelta, type BookingStatus } from "@/lib/bookings";

/**
 * Moves a booking to a new status and keeps the departure's seats in step.
 * Shared by the dashboard route and by payment webhooks (auto-confirm), so both obey the same rules.
 */
export async function applyBookingStatus(
  db: Db,
  tenantId: number,
  bookingId: number,
  next: Exclude<BookingStatus, "PENDING">,
) {
  const booking = await db.query.bookings.findFirst({
    where: and(eq(schema.bookings.id, bookingId), eq(schema.bookings.tenantId, tenantId)),
  });
  if (!booking) throw new ApiError(404, "Booking not found");

  const from = booking.status as BookingStatus;
  if (!canTransition(from, next)) {
    throw new ApiError(409, `A ${from.toLowerCase()} booking can't be marked ${next.toLowerCase()}.`, "INVALID_TRANSITION");
  }

  const delta = seatDelta(from, next, booking.groupSize);
  const D = schema.departures;
  if (delta > 0) {
    // Conditional update: two confirmations at once can't both take the last seats.
    const result = await db.run(sql`
      UPDATE ${D}
      SET available_spots = available_spots - ${delta},
          status = CASE WHEN status = 'OPEN' AND available_spots - ${delta} = 0 THEN 'FULL' ELSE status END,
          updated_at = unixepoch() * 1000
      WHERE id = ${booking.departureId} AND available_spots >= ${delta}
    `);
    if (result.meta.changes === 0) throw new ApiError(409, "Not enough spots available", "NOT_ENOUGH_SPOTS");
  } else if (delta < 0) {
    await db.run(sql`
      UPDATE ${D}
      SET available_spots = MIN(capacity, available_spots + ${-delta}),
          status = CASE WHEN status = 'FULL' THEN 'OPEN' ELSE status END,
          updated_at = unixepoch() * 1000
      WHERE id = ${booking.departureId}
    `);
  }

  // Guard on the old status so a double click can't apply the change twice.
  const [updated] = await db
    .update(schema.bookings)
    .set({ status: next, updatedAt: new Date() })
    .where(and(eq(schema.bookings.id, bookingId), eq(schema.bookings.status, from)))
    .returning();
  if (!updated) {
    if (delta !== 0) {
      await db.run(sql`
        UPDATE ${D}
        SET available_spots = MAX(0, MIN(capacity, available_spots + ${-delta})),
            updated_at = unixepoch() * 1000
        WHERE id = ${booking.departureId}
      `);
    }
    throw new ApiError(409, "This booking was just changed. Refresh and try again.", "INVALID_TRANSITION");
  }

  if (from !== "CONFIRMED" && next === "CONFIRMED") {
    await db
      .update(schema.activities)
      .set({ bookingsCount: sql`${schema.activities.bookingsCount} + 1` })
      .where(eq(schema.activities.id, booking.activityId));
  } else if (from === "CONFIRMED" && next === "CANCELLED") {
    await db
      .update(schema.activities)
      .set({ bookingsCount: sql`MAX(0, ${schema.activities.bookingsCount} - 1)` })
      .where(eq(schema.activities.id, booking.activityId));
  }
  return updated;
}
