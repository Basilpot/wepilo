import { Hono } from "hono";
import { z } from "zod";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@/db";
import * as schema from "@/db/schema";
import type { AppEnv } from "@/types";
import { ApiError, paginate, paginationSchema } from "@/lib/http";
import { requireStaff, requireTenant } from "@/middleware/context";
import { rateLimit, LIMITS } from "@/lib/rate-limit";
import { encryptSecret, decryptSecret, maskSecret } from "@/lib/secrets";
import {
  StripeError,
  createCheckoutSession,
  createWebhookEndpoint,
  deleteWebhookEndpoint,
  refundPaymentIntent,
  stripeAccount,
  toMinor,
  verifyStripeSignature,
} from "@/lib/stripe";
import { bookingBalance, getSettings, paymentStatusOf, quoteCharge, settlePayment, stripeKeyFor } from "@/lib/payments";
import { sendOwnerAlert } from "@/lib/notify";

const CURRENCY = /^[A-Z]{3}$/;

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** The traveller returns to the agency's own site, never to an address the caller invents. */
export function allowedReturnUrl(
  env: { ENVIRONMENT: string },
  tenant: { website: string | null; customDomain: string | null },
  raw: string,
) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  const local = env.ENVIRONMENT !== "production" && ["localhost", "127.0.0.1"].includes(url.hostname);
  if (url.protocol !== "https:" && !local) return false;
  if (local) return true;
  const hosts = new Set<string>();
  for (const v of [tenant.website, tenant.customDomain]) {
    if (!v) continue;
    try {
      hosts.add(new URL(v.includes("://") ? v : `https://${v}`).hostname.replace(/^www\./, ""));
    } catch {
      /* ignore a malformed saved value */
    }
  }
  return hosts.has(url.hostname.replace(/^www\./, ""));
}

async function loadPayableBooking(db: Db, tenantId: number, bookingId: number, token: string) {
  const booking = await db.query.bookings.findFirst({
    where: and(eq(schema.bookings.id, bookingId), eq(schema.bookings.tenantId, tenantId)),
  });
  // Same answer for "no such booking" and "wrong token", so ids can't be probed.
  if (!booking || !booking.publicToken || !timingSafeEqual(booking.publicToken, token)) {
    throw new ApiError(404, "Booking not found");
  }
  if (booking.status !== "PENDING" && booking.status !== "CONFIRMED") {
    throw new ApiError(409, "This booking can no longer be paid.", "BOOKING_CLOSED");
  }
  return booking;
}

const payBody = z.object({
  bookingId: z.number().int(),
  token: z.string().min(10).max(100),
  kind: z.enum(["DEPOSIT", "FULL"]).default("FULL"),
});

// ── Public: website checkout ─────────────────────────────────────────────────

const publicRoutes = new Hono<AppEnv>()
  .get("/options", requireTenant(), async (c) => {
    const settings = await getSettings(c.get("db"), c.get("tenantId"));
    const stripe = Boolean(await stripeKeyFor(c.env, settings));
    return c.json({
      currency: settings?.currency ?? "USD",
      stripe,
      bankTransfer: settings?.bankEnabled ? { instructions: settings.bankInstructions } : null,
      depositPercent: settings?.depositPercent ?? null,
      online: stripe || Boolean(settings?.bankEnabled),
    });
  })
  .post("/checkout", requireTenant(), rateLimit(LIMITS.publicForm), async (c) => {
    const body = payBody
      .extend({ successUrl: z.string().url().max(500), cancelUrl: z.string().url().max(500) })
      .parse(await c.req.json());
    const db = c.get("db");
    const tenantId = c.get("tenantId");
    const booking = await loadPayableBooking(db, tenantId, body.bookingId, body.token);
    const settings = await getSettings(db, tenantId);
    const key = await stripeKeyFor(c.env, settings);
    if (!key) throw new ApiError(409, "Card payments aren't switched on for this agency.", "PAYMENTS_OFF");

    const tenant = await db.query.tenants.findFirst({
      where: eq(schema.tenants.id, tenantId),
      columns: { website: true, customDomain: true, companyName: true },
    });
    if (!tenant || !allowedReturnUrl(c.env, tenant, body.successUrl) || !allowedReturnUrl(c.env, tenant, body.cancelUrl)) {
      throw new ApiError(400, "successUrl and cancelUrl must be pages on the agency's own website.", "VALIDATION");
    }

    const balance = await bookingBalance(db, booking);
    const { amountMinor, kind } = quoteCharge(balance, settings!.depositPercent, body.kind);
    const activity = await db.query.activities.findFirst({ where: eq(schema.activities.id, booking.activityId), columns: { title: true } });

    // An older unpaid checkout for this booking is replaced; if the traveller still pays it, the webhook settles it anyway.
    await db
      .update(schema.payments)
      .set({ status: "EXPIRED", updatedAt: new Date() })
      .where(and(eq(schema.payments.bookingId, booking.id), eq(schema.payments.provider, "STRIPE"), eq(schema.payments.status, "PENDING")));
    const [payment] = await db
      .insert(schema.payments)
      .values({ tenantId, bookingId: booking.id, provider: "STRIPE", kind, amountMinor, currency: booking.currency })
      .returning();
    try {
      const session = await createCheckoutSession(key, {
        amountMinor,
        currency: booking.currency,
        name: `${activity?.title ?? "Trip"}${kind === "DEPOSIT" ? " (deposit)" : kind === "BALANCE" ? " (balance)" : ""}`,
        description: `Booking #${booking.id} with ${tenant.companyName ?? "your travel agency"}`,
        customerEmail: booking.email ?? undefined,
        successUrl: body.successUrl,
        cancelUrl: body.cancelUrl,
        metadata: { wepilo_payment_id: String(payment.id), wepilo_booking_id: String(booking.id), wepilo_tenant_id: String(tenantId) },
        idempotencyKey: `wepilo-payment-${payment.id}`,
      });
      await db.update(schema.payments).set({ providerRef: session.id, updatedAt: new Date() }).where(eq(schema.payments.id, payment.id));
      return c.json({ url: session.url, paymentId: payment.id, amountMinor, currency: booking.currency, kind });
    } catch (err) {
      await db.update(schema.payments).set({ status: "FAILED", note: err instanceof Error ? err.message : "Checkout failed", updatedAt: new Date() }).where(eq(schema.payments.id, payment.id));
      if (err instanceof StripeError) {
        await db.update(schema.tenantPaymentSettings).set({ lastError: err.message, updatedAt: new Date() }).where(eq(schema.tenantPaymentSettings.tenantId, tenantId));
        throw new ApiError(502, "The payment provider refused to start this checkout. Please try again or contact the agency.", "CHECKOUT_FAILED");
      }
      throw err;
    }
  })
  // Traveller says "I'll pay by bank transfer": record it so the agency can match the incoming money.
  .post("/bank-transfer", requireTenant(), rateLimit(LIMITS.publicForm), async (c) => {
    const body = payBody.parse(await c.req.json());
    const db = c.get("db");
    const tenantId = c.get("tenantId");
    const booking = await loadPayableBooking(db, tenantId, body.bookingId, body.token);
    const settings = await getSettings(db, tenantId);
    if (!settings?.bankEnabled) throw new ApiError(409, "Bank transfer isn't offered by this agency.", "PAYMENTS_OFF");
    const { amountMinor, kind } = quoteCharge(await bookingBalance(db, booking), settings.depositPercent, body.kind);

    const existing = await db.query.payments.findFirst({
      where: and(eq(schema.payments.bookingId, booking.id), eq(schema.payments.provider, "BANK_TRANSFER"), eq(schema.payments.status, "PENDING")),
    });
    const payment =
      existing ??
      (
        await db
          .insert(schema.payments)
          .values({ tenantId, bookingId: booking.id, provider: "BANK_TRANSFER", kind, amountMinor, currency: booking.currency })
          .returning()
      )[0]!;
    if (!existing) {
      const task = sendOwnerAlert(c.env, db, tenantId, {
        subject: `Bank transfer expected for booking #${booking.id}`,
        heading: "Bank transfer expected",
        path: "/bookings",
        fields: [
          ["Booking", `#${booking.id} ${booking.name ?? ""}`.trim()],
          ["Amount", `${(payment.amountMinor / 100).toFixed(2)} ${payment.currency}`],
          ["Reference", `WP-${booking.id}`],
        ],
      });
      try {
        c.executionCtx.waitUntil(task);
      } catch {
        await task;
      }
    }
    return c.json({
      paymentId: payment.id,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      reference: `WP-${booking.id}`,
      instructions: settings.bankInstructions,
    });
  })
  // Stripe calls this. No cookie, no key: the signature is the authentication.
  .post("/webhooks/stripe/:tenantId", async (c) => {
    const tenantId = Number(c.req.param("tenantId"));
    const db = c.get("db");
    const payload = await c.req.text();
    const settings = Number.isInteger(tenantId) ? await getSettings(db, tenantId) : undefined;
    const secret = settings?.stripeWebhookSecretEnc ? await decryptSecret(c.env, settings.stripeWebhookSecretEnc) : null;
    if (!secret || !(await verifyStripeSignature(payload, c.req.header("stripe-signature"), secret))) {
      return c.json({ error: "Invalid signature" }, 400);
    }

    const event = JSON.parse(payload) as { type: string; data: { object: { id: string; payment_status?: string; payment_intent?: string | null; amount_total?: number | null; currency?: string | null } } };
    const session = event.data.object;
    const payment = await db.query.payments.findFirst({
      where: and(eq(schema.payments.providerRef, session.id), eq(schema.payments.tenantId, tenantId)),
    });
    if (!payment) return c.json({ received: true });

    if (event.type === "checkout.session.completed" && session.payment_status === "paid") {
      // The amount we charged is what we recorded; anything else is held for a person to look at.
      if (session.amount_total !== payment.amountMinor || session.currency?.toUpperCase() !== payment.currency) {
        await db
          .update(schema.payments)
          .set({ status: "REVIEW", note: `Stripe reported ${session.amount_total} ${session.currency} but ${payment.amountMinor} ${payment.currency} was expected.`, providerPaymentId: session.payment_intent ?? null, updatedAt: new Date() })
          .where(eq(schema.payments.id, payment.id));
        return c.json({ received: true });
      }
      await settlePayment(c.env, db, payment.id, { providerPaymentId: session.payment_intent });
    } else if (event.type === "checkout.session.expired") {
      await db.update(schema.payments).set({ status: "EXPIRED", updatedAt: new Date() }).where(and(eq(schema.payments.id, payment.id), eq(schema.payments.status, "PENDING")));
    }
    return c.json({ received: true });
  });

// ── Staff ────────────────────────────────────────────────────────────────────

const settingsView = (s: schema.TenantPaymentSettings | undefined, keyHint: string | null) => ({
  currency: s?.currency ?? "USD",
  stripe: {
    connected: Boolean(s?.stripeSecretKeyEnc),
    enabled: s?.stripeEnabled ?? false,
    verifiedAt: s?.stripeVerifiedAt ?? null,
    accountName: s?.stripeAccountName ?? null,
    live: s?.stripeLive ?? false,
    keyHint,
    hasWebhook: Boolean(s?.stripeWebhookSecretEnc),
  },
  currencyTranslation: s?.currencyTranslation ?? false,
  bankEnabled: s?.bankEnabled ?? false,
  bankInstructions: s?.bankInstructions ?? "",
  depositPercent: s?.depositPercent ?? null,
  autoConfirm: s?.autoConfirm ?? false,
  lastError: s?.lastError ?? null,
});

const staffRoutes = new Hono<AppEnv>()
  .get("/settings", requireStaff("OWNER", "ADMIN"), requireTenant(), async (c) => {
    const s = await getSettings(c.get("db"), c.get("tenantId"));
    const key = s?.stripeSecretKeyEnc ? await decryptSecret(c.env, s.stripeSecretKeyEnc) : null;
    return c.json(settingsView(s, key ? maskSecret(key) : null));
  })
  .put("/settings", requireStaff("OWNER", "ADMIN"), requireTenant(), async (c) => {
    const body = z
      .object({
        currency: z.string().trim().toUpperCase().regex(CURRENCY, "must be a 3-letter currency code like USD").optional(),
        currencyTranslation: z.boolean().optional(),
        stripeEnabled: z.boolean().optional(),
        bankEnabled: z.boolean().optional(),
        bankInstructions: z.string().trim().max(2000).nullable().optional(),
        depositPercent: z.number().int().min(1).max(99).nullable().optional(),
        autoConfirm: z.boolean().optional(),
      })
      .parse(await c.req.json());
    const db = c.get("db");
    const tenantId = c.get("tenantId");
    const existing = await getSettings(db, tenantId);
    if (body.stripeEnabled && !existing?.stripeVerifiedAt) {
      throw new ApiError(409, "Connect and verify your Stripe account before switching card payments on.", "STRIPE_NOT_CONNECTED");
    }
    if (body.bankEnabled && !(body.bankInstructions ?? existing?.bankInstructions)?.trim()) {
      throw new ApiError(400, "bankInstructions: tell travellers where to send the money", "VALIDATION");
    }
    const values = {
      ...(body.currency !== undefined ? { currency: body.currency } : {}),
      ...(body.currencyTranslation !== undefined ? { currencyTranslation: body.currencyTranslation } : {}),
      ...(body.stripeEnabled !== undefined ? { stripeEnabled: body.stripeEnabled } : {}),
      ...(body.bankEnabled !== undefined ? { bankEnabled: body.bankEnabled } : {}),
      ...(body.bankInstructions !== undefined ? { bankInstructions: body.bankInstructions || null } : {}),
      ...(body.depositPercent !== undefined ? { depositPercent: body.depositPercent } : {}),
      ...(body.autoConfirm !== undefined ? { autoConfirm: body.autoConfirm } : {}),
      updatedAt: new Date(),
    };
    await db.insert(schema.tenantPaymentSettings).values({ tenantId, ...values }).onConflictDoUpdate({ target: schema.tenantPaymentSettings.tenantId, set: values });
    const s = await getSettings(db, tenantId);
    const key = s?.stripeSecretKeyEnc ? await decryptSecret(c.env, s.stripeSecretKeyEnc) : null;
    return c.json(settingsView(s, key ? maskSecret(key) : null));
  })
  // Checks the key with Stripe, then registers the webhook so payments settle on their own.
  .post("/settings/stripe", requireStaff("OWNER", "ADMIN"), requireTenant(), async (c) => {
    const body = z.object({ secretKey: z.string().trim().regex(/^(sk|rk)_(test|live)_[A-Za-z0-9]+$/, "must be a Stripe secret or restricted key (sk_… / rk_…)") }).parse(await c.req.json());
    const db = c.get("db");
    const tenantId = c.get("tenantId");
    let account;
    try {
      account = await stripeAccount(body.secretKey);
    } catch (err) {
      throw new ApiError(422, err instanceof StripeError ? `Stripe rejected that key: ${err.message}` : "Couldn't reach Stripe. Try again in a moment.", "STRIPE_KEY_INVALID");
    }
    const existing = await getSettings(db, tenantId);
    // Replace the old webhook when the key changes.
    if (existing?.stripeWebhookId && existing.stripeSecretKeyEnc) {
      const oldKey = await decryptSecret(c.env, existing.stripeSecretKeyEnc);
      if (oldKey) await deleteWebhookEndpoint(oldKey, existing.stripeWebhookId).catch(() => null);
    }
    let webhook: { id: string; secret: string } | null = null;
    let lastError: string | null = null;
    try {
      webhook = await createWebhookEndpoint(body.secretKey, `${c.env.API_BASE_URL}/api/v1/payments/webhooks/stripe/${tenantId}`);
    } catch (err) {
      lastError = `Connected, but the webhook couldn't be created (${err instanceof Error ? err.message : "unknown error"}). Payments will still be picked up within the hour.`;
    }
    const values = {
      stripeSecretKeyEnc: await encryptSecret(c.env, body.secretKey),
      stripeWebhookSecretEnc: webhook ? await encryptSecret(c.env, webhook.secret) : null,
      stripeWebhookId: webhook?.id ?? null,
      stripeAccountName: account.business_profile?.name ?? account.settings?.dashboard?.display_name ?? account.id,
      stripeLive: body.secretKey.includes("_live_"),
      stripeVerifiedAt: new Date(),
      stripeEnabled: true,
      lastError,
      updatedAt: new Date(),
    };
    await db.insert(schema.tenantPaymentSettings).values({ tenantId, ...values }).onConflictDoUpdate({ target: schema.tenantPaymentSettings.tenantId, set: values });
    const s = await getSettings(db, tenantId);
    return c.json(settingsView(s, maskSecret(body.secretKey)));
  })
  .delete("/settings/stripe", requireStaff("OWNER", "ADMIN"), requireTenant(), async (c) => {
    const db = c.get("db");
    const tenantId = c.get("tenantId");
    const s = await getSettings(db, tenantId);
    if (s?.stripeWebhookId && s.stripeSecretKeyEnc) {
      const key = await decryptSecret(c.env, s.stripeSecretKeyEnc);
      if (key) await deleteWebhookEndpoint(key, s.stripeWebhookId).catch(() => null);
    }
    await db
      .update(schema.tenantPaymentSettings)
      .set({ stripeSecretKeyEnc: null, stripeWebhookSecretEnc: null, stripeWebhookId: null, stripeAccountName: null, stripeVerifiedAt: null, stripeEnabled: false, stripeLive: false, lastError: null, updatedAt: new Date() })
      .where(eq(schema.tenantPaymentSettings.tenantId, tenantId));
    return c.json(settingsView(await getSettings(db, tenantId), null));
  })
  .get("/", requireStaff("OWNER", "ADMIN", "MANAGER"), requireTenant(), async (c) => {
    const db = c.get("db");
    const q = paginationSchema
      .extend({
        bookingId: z.coerce.number().int().optional(),
        status: z.enum(["PENDING", "PAID", "REVIEW", "FAILED", "EXPIRED", "REFUNDED"]).optional(),
      })
      .parse(c.req.query());
    const conditions = [eq(schema.payments.tenantId, c.get("tenantId"))];
    if (q.bookingId) conditions.push(eq(schema.payments.bookingId, q.bookingId));
    if (q.status) conditions.push(eq(schema.payments.status, q.status));
    const [total] = await db.select({ value: count() }).from(schema.payments).where(and(...conditions));
    const rows = await db.query.payments.findMany({
      where: and(...conditions),
      with: { booking: { columns: { id: true, name: true, email: true } } },
      orderBy: [desc(schema.payments.createdAt)],
      limit: q.limit,
      offset: (q.page - 1) * q.limit,
    });
    return c.json(paginate(rows, q.page, q.limit, total.value));
  })
  // Money that arrived outside checkout: cash at the office, a bank transfer, anything else.
  .post("/manual", requireStaff("OWNER", "ADMIN", "MANAGER"), requireTenant(), async (c) => {
    const body = z
      .object({
        bookingId: z.number().int(),
        amount: z.number().positive().max(10_000_000),
        provider: z.enum(["BANK_TRANSFER", "CASH", "OTHER"]),
        note: z.string().trim().max(500).optional(),
      })
      .parse(await c.req.json());
    const db = c.get("db");
    const tenantId = c.get("tenantId");
    const booking = await db.query.bookings.findFirst({ where: and(eq(schema.bookings.id, body.bookingId), eq(schema.bookings.tenantId, tenantId)) });
    if (!booking) throw new ApiError(404, "Booking not found");
    if (booking.status === "CANCELLED") throw new ApiError(409, "This booking is cancelled.", "BOOKING_CLOSED");
    const balance = await bookingBalance(db, booking);
    const amountMinor = toMinor(body.amount, booking.currency);
    if (amountMinor > balance.dueMinor) {
      throw new ApiError(409, "That is more than is still due on this booking.", "OVERPAYMENT");
    }
    const [payment] = await db
      .insert(schema.payments)
      .values({
        tenantId,
        bookingId: booking.id,
        provider: body.provider,
        kind: balance.paidMinor > 0 ? "BALANCE" : amountMinor >= balance.dueMinor ? "FULL" : "DEPOSIT",
        amountMinor,
        currency: booking.currency,
        status: "PAID",
        note: body.note || null,
        paidAt: new Date(),
      })
      .returning();
    return c.json({ payment }, 201);
  })
  .patch("/:id/mark-paid", requireStaff("OWNER", "ADMIN", "MANAGER"), requireTenant(), async (c) => {
    const db = c.get("db");
    const id = Number(c.req.param("id"));
    const [payment] = await db
      .update(schema.payments)
      .set({ status: "PAID", paidAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(schema.payments.id, id),
          eq(schema.payments.tenantId, c.get("tenantId")),
          inArray(schema.payments.status, ["PENDING", "REVIEW", "EXPIRED"]),
          // Card payments are settled by Stripe, not by hand.
          sql`${schema.payments.provider} != 'STRIPE' OR ${schema.payments.status} = 'REVIEW'`,
        ),
      )
      .returning();
    if (!payment) throw new ApiError(409, "This payment can't be marked as received.", "INVALID_STATE");
    return c.json({ payment });
  })
  .post("/:id/refund", requireStaff("OWNER", "ADMIN"), requireTenant(), async (c) => {
    const db = c.get("db");
    const tenantId = c.get("tenantId");
    const id = Number(c.req.param("id"));
    const payment = await db.query.payments.findFirst({ where: and(eq(schema.payments.id, id), eq(schema.payments.tenantId, tenantId)) });
    if (!payment) throw new ApiError(404, "Payment not found");
    if (payment.status !== "PAID" && payment.status !== "REVIEW") throw new ApiError(409, "Only received payments can be refunded.", "INVALID_STATE");

    let note = payment.note;
    if (payment.provider === "STRIPE") {
      const key = await stripeKeyFor(c.env, await getSettings(db, tenantId));
      if (!key || !payment.providerPaymentId) throw new ApiError(409, "This card payment can't be refunded from here. Refund it in your Stripe dashboard.", "REFUND_UNAVAILABLE");
      try {
        await refundPaymentIntent(key, payment.providerPaymentId, `wepilo-refund-${payment.id}`);
      } catch (err) {
        throw new ApiError(422, err instanceof StripeError ? `Stripe could not refund: ${err.message}` : "Couldn't reach Stripe. Try again.", "REFUND_FAILED");
      }
    } else {
      note = [note, "Refund handed back outside Wepilo."].filter(Boolean).join(" ");
    }
    const [updated] = await db
      .update(schema.payments)
      .set({ status: "REFUNDED", note, updatedAt: new Date() })
      .where(and(eq(schema.payments.id, id), inArray(schema.payments.status, ["PAID", "REVIEW"])))
      .returning();
    return c.json({ payment: updated });
  });

export const paymentRoutes = new Hono<AppEnv>().route("/", publicRoutes).route("/", staffRoutes);
export { paymentStatusOf };
