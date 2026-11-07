export type BookingStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";

/**
 * Where a booking may go next. Seats are held only while CONFIRMED, so:
 *  - PENDING → CONFIRMED takes seats
 *  - CONFIRMED → CANCELLED gives them back
 *  - CANCELLED and COMPLETED are final
 */
export const BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "CANCELLED"],
  CANCELLED: [],
  COMPLETED: [],
};

export function canTransition(from: BookingStatus, to: BookingStatus) {
  return BOOKING_TRANSITIONS[from].includes(to);
}

/** Net change in held seats for a transition: positive takes seats, negative returns them. */
export function seatDelta(from: BookingStatus, to: BookingStatus, groupSize: number) {
  if (from !== "CONFIRMED" && to === "CONFIRMED") return groupSize;
  if (from === "CONFIRMED" && to === "CANCELLED") return -groupSize;
  return 0;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real calendar date written as YYYY-MM-DD. */
export function isIsoDate(value: string) {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Sum of per-person extra prices for the chosen group. Extras without a price are free. */
export function extrasTotal(extras: Array<{ price: number | null }>, groupSize: number) {
  return extras.reduce((sum, e) => sum + (e.price && e.price > 0 ? e.price * groupSize : 0), 0);
}
