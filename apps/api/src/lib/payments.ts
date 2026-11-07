import { and, eq, inArray, sql } from "drizzle-orm";
import type { Env } from "@/env";
import type { Db } from "@/db";
import * as schema from "@/db/schema";
import { ApiError } from "@/lib/http";
import { applyBookingStatus } from "@/lib/booking-actions";
import { sendOwnerAlert } from "@/lib/notify";
import { decryptSecret } from "@/lib/secrets";
import { fromMinor, getCheckoutSession, toMinor } from "@/lib/stripe";

export type PaymentKind = "DEPOSIT" | "BALANCE" | "FULL";

/** What a booking costs, what has arrived and what is still due, all in minor units. */
export async function bookingBalance(db: Db, booking: Pick<schema.Booking, "id" | "totalPrice" | "currency">) {
  const [row] = await db
    .select({ paid: sql<number>`COALESCE(SUM(${schema.payments.amountMinor}), 0)` })
    .from(schema.payments)
    .where(and(eq(schema.payments.bookingId, booking.id), eq(schema.payments.status, "PAID")));
  const totalMinor = toMinor(booking.totalPrice, booking.currency);
  const paidMinor = Number(row?.paid ?? 0);
  return { totalMinor, paidMinor, dueMinor: Math.max(0, totalMinor - paidMinor) };
}

/** Amount to charge now. A deposit is only offered before anything has been paid. */
export function quoteCharge(
  balance: { totalMinor: number; paidMinor: number; dueMinor: number },
  depositPercent: number | null,
  want: "DEPOSIT" | "FULL",
): { amountMinor: number; kind: PaymentKind } {
  if (balance.dueMinor <= 0) throw new ApiError(409, "This booking is already paid in full.", "ALREADY_PAID");
  if (want === "DEPOSIT") {
    if (!depositPercent) throw new ApiError(400, "kind: this agency doesn't take deposits", "VALIDATION");
    if (balance.paidMinor > 0) throw new ApiError(409, "A deposit was already paid. Pay the balance instead.", "DEPOSIT_PAID");
    const amountMinor = Math.min(balance.dueMinor, Math.max(1, Math.round((balance.totalMinor * depositPercent) / 100)));
    return { amountMinor, kind: amountMinor >= balance.dueMinor ? "FULL" : "DEPOSIT" };
  }
  return { amountMinor: balance.dueMinor, kind: balance.paidMinor > 0 ? "BALANCE" : "FULL" };
}

export const paymentStatusOf = (b: { totalMinor: number; paidMinor: number }) =>
  b.paidMinor <= 0 ? "UNPAID" : b.paidMinor >= b.totalMinor ? "PAID" : "PARTIAL";

export async function getSettings(db: Db, tenantId: number) {
  return db.query.tenantPaymentSettings.findFirst({ where: eq(schema.tenantPaymentSettings.tenantId, tenantId) });
}

export async function stripeKeyFor(env: Env, settings: schema.TenantPaymentSettings | undefined) {
  if (!settings?.stripeEnabled || !settings.stripeVerifiedAt || !settings.stripeSecretKeyEnc) return null;
  return decryptSecret(env, settings.stripeSecretKeyEnc);
}

/**
 * Marks a payment received, exactly once, and runs what follows from it.
 * Safe to call from the webhook and the reconciler at the same time: only one of them wins the update.
 * If the agency auto-confirms and the departure sold out meanwhile, the payment goes to REVIEW
 * so a person can refund or find a seat; money is never silently kept against an unconfirmed trip.
 */
export async function settlePayment(
  env: Env,
  db: Db,
  paymentId: number,
  details: { providerPaymentId?: string | null } = {},
) {
  const [paid] = await db
    .update(schema.payments)
    .set({
      status: "PAID",
      paidAt: new Date(),
      providerPaymentId: details.providerPaymentId ?? sql`${schema.payments.providerPaymentId}`,
      updatedAt: new Date(),
    })
    .where(and(eq(schema.payments.id, paymentId), inArray(schema.payments.status, ["PENDING", "EXPIRED", "REVIEW"])))
    .returning();
  if (!paid) return { settled: false as const };

  const [booking, settings] = await Promise.all([
    db.query.bookings.findFirst({ where: eq(schema.bookings.id, paid.bookingId) }),
    getSettings(db, paid.tenantId),
  ]);
  if (!booking) return { settled: true as const, payment: paid };

  let review = false;
  if (settings?.autoConfirm && booking.status === "PENDING") {
    try {
      await applyBookingStatus(db, paid.tenantId, booking.id, "CONFIRMED");
    } catch (err) {
      if (err instanceof ApiError && err.code === "NOT_ENOUGH_SPOTS") review = true;
      else if (!(err instanceof ApiError && err.code === "INVALID_TRANSITION")) throw err;
    }
  } else if (booking.status === "CANCELLED") {
    review = true; // paid for a booking that was cancelled in the meantime
  }
  if (review) {
    await db
      .update(schema.payments)
      .set({
        status: "REVIEW",
        note: booking.status === "CANCELLED" ? "Paid after the booking was cancelled." : "Paid, but the departure sold out before it could be confirmed.",
        updatedAt: new Date(),
      })
      .where(eq(schema.payments.id, paid.id));
  }

  const amount = new Intl.NumberFormat("en", { style: "currency", currency: paid.currency }).format(fromMinor(paid.amountMinor, paid.currency));
  await sendOwnerAlert(env, db, paid.tenantId, {
    subject: review ? `Payment needs review: booking #${booking.id}` : `Payment received: ${amount}`,
    heading: review ? "Payment needs your attention" : "Payment received",
    path: "/bookings",
    fields: [
      ["Booking", `#${booking.id} ${booking.name ?? ""}`.trim()],
      ["Amount", amount],
      ["Method", paid.provider.replace("_", " ").toLowerCase()],
      ["Status", review ? "Needs review: refund it or free up a seat, then mark it paid." : booking.status === "CONFIRMED" || settings?.autoConfirm ? "Booking confirmed." : "Booking is waiting for you to confirm it."],
    ],
  });
  return { settled: true as const, payment: { ...paid, status: review ? ("REVIEW" as const) : paid.status } };
}

/**
 * Safety net for missed webhooks: asks Stripe about checkouts still pending after 15 minutes.
 * Runs hourly from the cron trigger.
 */
export async function reconcileStripePayments(env: Env, db: Db, now = Date.now()) {
  const pending = await db.query.payments.findMany({
    where: and(
      eq(schema.payments.provider, "STRIPE"),
      eq(schema.payments.status, "PENDING"),
      sql`${schema.payments.createdAt} < ${now - 15 * 60 * 1000}`,
      sql`${schema.payments.createdAt} > ${now - 3 * 24 * 60 * 60 * 1000}`,
    ),
    limit: 50,
  });
  let settled = 0;
  let expired = 0;
  const keys = new Map<number, string | null>();
  for (const p of pending) {
    if (!p.providerRef) continue;
    if (!keys.has(p.tenantId)) keys.set(p.tenantId, await stripeKeyFor(env, await getSettings(db, p.tenantId)));
    const key = keys.get(p.tenantId);
    if (!key) continue;
    try {
      const session = await getCheckoutSession(key, p.providerRef);
      if (session.payment_status === "paid") {
        const r = await settlePayment(env, db, p.id, { providerPaymentId: session.payment_intent });
        if (r.settled) settled += 1;
      } else if (session.status === "expired") {
        await db.update(schema.payments).set({ status: "EXPIRED", updatedAt: new Date() }).where(and(eq(schema.payments.id, p.id), eq(schema.payments.status, "PENDING")));
        expired += 1;
      }
    } catch (err) {
      console.error("reconcile failed", p.id, err);
    }
  }
  return { checked: pending.length, settled, expired };
}
