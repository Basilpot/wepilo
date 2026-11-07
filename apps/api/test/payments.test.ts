import { describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { quoteCharge, reconcileStripePayments } from "@/lib/payments";
import { toMinor, verifyStripeSignature } from "@/lib/stripe";
import { allowedReturnUrl } from "@/routes/payments";
import { call, db, makeTenant, makeTrip } from "./helpers";

const realFetch = globalThis.fetch;

type StripeCall = { method: string; path: string; body: URLSearchParams };
function mockStripe(handler: (c: StripeCall) => unknown) {
  const calls: StripeCall[] = [];
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const u = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (u.startsWith("https://api.stripe.com/v1")) {
      const entry = { method: init?.method ?? "GET", path: u.replace("https://api.stripe.com/v1", ""), body: new URLSearchParams(String(init?.body ?? "")) };
      calls.push(entry);
      const out = handler(entry);
      return new Response(JSON.stringify(out), { status: out && (out as { error?: unknown }).error ? 402 : 200 });
    }
    return realFetch(input, init);
  });
  return { calls, restore: () => vi.stubGlobal("fetch", realFetch) };
}

async function sign(payload: string, secret: string, t = Math.floor(Date.now() / 1000)) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${payload}`))))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `t=${t},v1=${sig}`;
}

async function connectStripe(token: string, extra: object = {}) {
  const stripe = mockStripe((c) =>
    c.path === "/account" ? { id: "acct_1", business_profile: { name: "Agency Ltd" } } : c.path === "/webhook_endpoints" ? { id: "we_1", secret: "whsec_test123" } : {},
  );
  try {
    const res = await call("/api/v1/payments/settings/stripe", { staff: token, body: { secretKey: "sk_test_abc123" } });
    expect(res.status).toBe(200);
    if (Object.keys(extra).length) await call("/api/v1/payments/settings", { method: "PUT", staff: token, body: extra });
    return res.json;
  } finally {
    stripe.restore();
  }
}

async function newBooking(slug: string, activityId: number, departureId: number, groupSize = 2) {
  const res = await call("/api/v1/bookings", {
    slug,
    body: { activityId, departureId, groupSize, name: "Asha", email: "asha@example.com", phone: "+977 9800000000" },
  });
  expect(res.status).toBe(201);
  return res.json.booking as { id: number; publicToken: string; totalPrice: number; currency: string };
}

describe("payment maths", () => {
  it("quotes deposits and balances, never over-charging", () => {
    const fresh = { totalMinor: 100_000, paidMinor: 0, dueMinor: 100_000 };
    expect(quoteCharge(fresh, 20, "DEPOSIT")).toEqual({ amountMinor: 20_000, kind: "DEPOSIT" });
    expect(quoteCharge(fresh, null, "FULL")).toEqual({ amountMinor: 100_000, kind: "FULL" });
    expect(quoteCharge({ ...fresh, paidMinor: 20_000, dueMinor: 80_000 }, 20, "FULL")).toEqual({ amountMinor: 80_000, kind: "BALANCE" });
    expect(() => quoteCharge({ ...fresh, paidMinor: 20_000, dueMinor: 80_000 }, 20, "DEPOSIT")).toThrow();
    expect(() => quoteCharge({ ...fresh, paidMinor: 100_000, dueMinor: 0 }, 20, "FULL")).toThrow();
    expect(() => quoteCharge(fresh, null, "DEPOSIT")).toThrow();
  });
  it("handles zero-decimal currencies", () => {
    expect(toMinor(19.99, "USD")).toBe(1999);
    expect(toMinor(5000, "JPY")).toBe(5000);
  });
  it("only returns to the agency's own site", () => {
    const tenant = { website: "https://www.agency.test", customDomain: null };
    const prod = { ENVIRONMENT: "production" };
    expect(allowedReturnUrl(prod, tenant, "https://agency.test/thanks")).toBe(true);
    expect(allowedReturnUrl(prod, tenant, "https://evil.test/thanks")).toBe(false);
    expect(allowedReturnUrl(prod, tenant, "http://agency.test/thanks")).toBe(false);
    expect(allowedReturnUrl(prod, tenant, "http://localhost:3000/x")).toBe(false);
    expect(allowedReturnUrl({ ENVIRONMENT: "development" }, tenant, "http://localhost:3000/x")).toBe(true);
    expect(allowedReturnUrl(prod, { website: null, customDomain: null }, "https://agency.test/x")).toBe(false);
  });
  it("verifies Stripe signatures and rejects stale or forged ones", async () => {
    const body = '{"a":1}';
    expect(await verifyStripeSignature(body, await sign(body, "whsec_x"), "whsec_x")).toBe(true);
    expect(await verifyStripeSignature(body, await sign(body, "whsec_other"), "whsec_x")).toBe(false);
    expect(await verifyStripeSignature(body + " ", await sign(body, "whsec_x"), "whsec_x")).toBe(false);
    expect(await verifyStripeSignature(body, await sign(body, "whsec_x", 1000), "whsec_x")).toBe(false);
    expect(await verifyStripeSignature(body, undefined, "whsec_x")).toBe(false);
  });
});

describe("connecting Stripe", () => {
  it("verifies the key, stores it encrypted and registers the webhook", async () => {
    const { tenant, token } = await makeTenant();
    const view = await connectStripe(token);
    expect(view.stripe).toMatchObject({ connected: true, enabled: true, accountName: "Agency Ltd", live: false, hasWebhook: true });
    expect(JSON.stringify(view)).not.toContain("sk_test_abc123");
    const row = await db().query.tenantPaymentSettings.findFirst({ where: eq(schema.tenantPaymentSettings.tenantId, tenant.id) });
    expect(row?.stripeSecretKeyEnc).toBeTruthy();
    expect(row?.stripeSecretKeyEnc).not.toContain("sk_test");
  });

  it("rejects a key Stripe refuses and malformed keys", async () => {
    const { token } = await makeTenant();
    const bad = await call("/api/v1/payments/settings/stripe", { staff: token, body: { secretKey: "not-a-key" } });
    expect(bad.status).toBe(400);
    const stripe = mockStripe(() => ({ error: { message: "Invalid API Key provided" } }));
    try {
      const refused = await call("/api/v1/payments/settings/stripe", { staff: token, body: { secretKey: "sk_test_nope123" } });
      expect(refused.status).toBe(422);
      expect(refused.json.code).toBe("STRIPE_KEY_INVALID");
    } finally {
      stripe.restore();
    }
  });

  it("won't switch cards on before a key is verified", async () => {
    const { token } = await makeTenant();
    const res = await call("/api/v1/payments/settings", { method: "PUT", staff: token, body: { stripeEnabled: true } });
    expect(res.status).toBe(409);
  });
});

describe("card checkout", () => {
  async function setup(settings: object = {}) {
    const { tenant, token } = await makeTenant();
    await db().update(schema.tenants).set({ website: "https://agency.test" }).where(eq(schema.tenants.id, tenant.id));
    await connectStripe(token, { currency: "EUR", ...settings });
    const { activity, departure } = await makeTrip(tenant.id, { price: 500, capacity: 4 });
    const booking = await newBooking(tenant.slug, activity.id, departure.id, 2);
    return { tenant, token, activity, departure, booking };
  }
  const pay = (slug: string, booking: { id: number; publicToken: string }, extra: object = {}) =>
    call("/api/v1/payments/checkout", {
      slug,
      body: { bookingId: booking.id, token: booking.publicToken, successUrl: "https://agency.test/thanks", cancelUrl: "https://agency.test/cart", ...extra },
    });

  it("stamps bookings with the agency currency and a private pay token", async () => {
    const { booking, token } = await setup();
    expect(booking.currency).toBe("EUR");
    expect(booking.publicToken).toMatch(/^bk_/);
    const staffView = await call(`/api/v1/bookings/${booking.id}`, { staff: token });
    expect(staffView.text).not.toContain(booking.publicToken);
  });

  it("charges the server-computed amount, with deposits", async () => {
    const { tenant, booking } = await setup({ depositPercent: 25 });
    const stripe = mockStripe((c) => (c.path === "/checkout/sessions" ? { id: "cs_1", url: "https://checkout.stripe.test/cs_1" } : {}));
    try {
      const res = await pay(tenant.slug, booking, { kind: "DEPOSIT", amount: 1 });
      expect(res.status).toBe(200);
      expect(res.json.url).toBe("https://checkout.stripe.test/cs_1");
      expect(res.json.amountMinor).toBe(25_000);
      const session = stripe.calls.find((c) => c.path === "/checkout/sessions")!;
      expect(session.body.get("line_items[0][price_data][unit_amount]")).toBe("25000");
      expect(session.body.get("line_items[0][price_data][currency]")).toBe("eur");
      expect(session.body.get("metadata[wepilo_booking_id]")).toBe(String(booking.id));
    } finally {
      stripe.restore();
    }
  });

  it("refuses wrong tokens, foreign return URLs and unknown bookings alike", async () => {
    const { tenant, booking } = await setup();
    expect((await pay(tenant.slug, { ...booking, publicToken: "bk_wrongwrongwrong" })).status).toBe(404);
    expect((await pay(tenant.slug, { id: 999999, publicToken: booking.publicToken })).status).toBe(404);
    const foreign = await pay(tenant.slug, booking, { successUrl: "https://evil.test/x" });
    expect(foreign.status).toBe(400);
  });

  it("settles on a signed webhook, once, and confirms the booking when auto-confirm is on", async () => {
    const { tenant, booking, departure } = await setup({ autoConfirm: true });
    const stripe = mockStripe((c) => (c.path === "/checkout/sessions" ? { id: "cs_pay", url: "https://checkout.stripe.test/cs_pay" } : {}));
    let paymentId: number;
    try {
      paymentId = (await pay(tenant.slug, booking)).json.paymentId;
    } finally {
      stripe.restore();
    }
    const event = JSON.stringify({
      type: "checkout.session.completed",
      data: { object: { id: "cs_pay", payment_status: "paid", payment_intent: "pi_1", amount_total: 100_000, currency: "eur" } },
    });
    const unsigned = await call(`/api/v1/payments/webhooks/stripe/${tenant.id}`, { body: JSON.parse(event), headers: { "stripe-signature": "t=1,v1=bad" } });
    expect(unsigned.status).toBe(400);

    for (let i = 0; i < 2; i++) {
      const res = await fetchWebhook(tenant.id, event, await sign(event, "whsec_test123"));
      expect(res.status).toBe(200);
    }
    const payment = await db().query.payments.findFirst({ where: eq(schema.payments.id, paymentId) });
    expect(payment).toMatchObject({ status: "PAID", providerPaymentId: "pi_1" });
    const b = await db().query.bookings.findFirst({ where: eq(schema.bookings.id, booking.id) });
    expect(b?.status).toBe("CONFIRMED");
    const dep = await db().query.departures.findFirst({ where: eq(schema.departures.id, departure.id) });
    expect(dep?.availableSpots).toBe(2); // seats taken once, not twice
  });

  it("holds a payment for review when the amount doesn't match", async () => {
    const { tenant, booking } = await setup();
    const stripe = mockStripe((c) => (c.path === "/checkout/sessions" ? { id: "cs_mis", url: "https://x.test" } : {}));
    let paymentId: number;
    try {
      paymentId = (await pay(tenant.slug, booking)).json.paymentId;
    } finally {
      stripe.restore();
    }
    const event = JSON.stringify({
      type: "checkout.session.completed",
      data: { object: { id: "cs_mis", payment_status: "paid", payment_intent: "pi_2", amount_total: 100, currency: "eur" } },
    });
    await fetchWebhook(tenant.id, event, await sign(event, "whsec_test123"));
    expect((await db().query.payments.findFirst({ where: eq(schema.payments.id, paymentId) }))?.status).toBe("REVIEW");
  });

  it("sends payment to review instead of keeping money when the trip sold out", async () => {
    const { tenant, token, activity, departure, booking } = await setup({ autoConfirm: true });
    // Someone else confirms the last seats first.
    const other = await newBooking(tenant.slug, activity.id, departure.id, 4);
    expect((await call(`/api/v1/bookings/${other.id}/status`, { method: "PATCH", staff: token, body: { status: "CONFIRMED" } })).status).toBe(200);

    const stripe = mockStripe((c) => (c.path === "/checkout/sessions" ? { id: "cs_full", url: "https://x.test" } : {}));
    let paymentId: number;
    try {
      paymentId = (await pay(tenant.slug, booking)).json.paymentId;
    } finally {
      stripe.restore();
    }
    const event = JSON.stringify({
      type: "checkout.session.completed",
      data: { object: { id: "cs_full", payment_status: "paid", payment_intent: "pi_3", amount_total: 100_000, currency: "eur" } },
    });
    await fetchWebhook(tenant.id, event, await sign(event, "whsec_test123"));
    const payment = await db().query.payments.findFirst({ where: eq(schema.payments.id, paymentId) });
    expect(payment?.status).toBe("REVIEW");
    expect((await db().query.bookings.findFirst({ where: eq(schema.bookings.id, booking.id) }))?.status).toBe("PENDING");
  });

  it("reconciler settles a paid checkout whose webhook never arrived", async () => {
    const { tenant, booking } = await setup();
    const stripe = mockStripe((c) =>
      c.path === "/checkout/sessions"
        ? { id: "cs_late", url: "https://x.test" }
        : c.path === "/checkout/sessions/cs_late"
          ? { id: "cs_late", status: "complete", payment_status: "paid", payment_intent: "pi_late" }
          : {},
    );
    try {
      const { paymentId } = (await pay(tenant.slug, booking)).json;
      await db().update(schema.payments).set({ createdAt: new Date(Date.now() - 30 * 60 * 1000) }).where(eq(schema.payments.id, paymentId));
      const result = await reconcileStripePayments(env, db());
      expect(result.settled).toBeGreaterThanOrEqual(1);
      expect((await db().query.payments.findFirst({ where: eq(schema.payments.id, paymentId) }))?.status).toBe("PAID");
    } finally {
      stripe.restore();
    }
  });
});

async function fetchWebhook(tenantId: number, body: string, signature: string) {
  const { app } = await import("@/app");
  const { createExecutionContext, waitOnExecutionContext } = await import("cloudflare:test");
  const ctx = createExecutionContext();
  const res = await app.fetch(
    new Request(`http://api.test/api/v1/payments/webhooks/stripe/${tenantId}`, { method: "POST", body, headers: { "stripe-signature": signature, "content-type": "application/json" } }),
    env,
    ctx,
  );
  await waitOnExecutionContext(ctx);
  return res;
}

describe("manual payments, bank transfer and refunds", () => {
  it("records offline money, blocks overpayment and reports balances", async () => {
    const { tenant, token } = await makeTenant();
    const { activity, departure } = await makeTrip(tenant.id, { price: 100, capacity: 4 });
    const booking = await newBooking(tenant.slug, activity.id, departure.id, 2); // 200 total

    const first = await call("/api/v1/payments/manual", { staff: token, body: { bookingId: booking.id, amount: 50, provider: "CASH" } });
    expect(first.status).toBe(201);
    expect(first.json.payment).toMatchObject({ amountMinor: 5000, status: "PAID", kind: "DEPOSIT" });
    const over = await call("/api/v1/payments/manual", { staff: token, body: { bookingId: booking.id, amount: 500, provider: "CASH" } });
    expect(over.status).toBe(409);
    expect(over.json.code).toBe("OVERPAYMENT");

    const list = await call("/api/v1/bookings", { staff: token });
    const row = list.json.data.find((b: { id: number }) => b.id === booking.id);
    expect(row.paidMinor).toBe(5000);
  });

  it("takes bank transfer requests with a reference and lets staff mark them received", async () => {
    const { tenant, token } = await makeTenant();
    await call("/api/v1/payments/settings", { method: "PUT", staff: token, body: { bankEnabled: true, bankInstructions: "IBAN 123" } });
    const { activity, departure } = await makeTrip(tenant.id, { price: 100 });
    const booking = await newBooking(tenant.slug, activity.id, departure.id, 1);

    const res = await call("/api/v1/payments/bank-transfer", { slug: tenant.slug, body: { bookingId: booking.id, token: booking.publicToken } });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ reference: `WP-${booking.id}`, instructions: "IBAN 123", amountMinor: 10_000 });
    const again = await call("/api/v1/payments/bank-transfer", { slug: tenant.slug, body: { bookingId: booking.id, token: booking.publicToken } });
    expect(again.json.paymentId).toBe(res.json.paymentId);

    const paid = await call(`/api/v1/payments/${res.json.paymentId}/mark-paid`, { method: "PATCH", staff: token });
    expect(paid.json.payment.status).toBe("PAID");
    const closed = await call("/api/v1/payments/bank-transfer", { slug: tenant.slug, body: { bookingId: booking.id, token: booking.publicToken } });
    expect(closed.status).toBe(409);
  });

  it("refunds card payments through Stripe and others by record", async () => {
    const { tenant, token } = await makeTenant();
    await connectStripe(token);
    const { activity, departure } = await makeTrip(tenant.id, { price: 100 });
    const booking = await newBooking(tenant.slug, activity.id, departure.id, 1);
    const [card] = await db().insert(schema.payments).values({ tenantId: tenant.id, bookingId: booking.id, provider: "STRIPE", amountMinor: 10_000, currency: "USD", status: "PAID", providerPaymentId: "pi_refund" }).returning();

    const stripe = mockStripe((c) => (c.path === "/refunds" ? { id: "re_1", status: "succeeded" } : {}));
    try {
      const res = await call(`/api/v1/payments/${card.id}/refund`, { staff: token, body: {} });
      expect(res.json.payment.status).toBe("REFUNDED");
      expect(stripe.calls.find((c) => c.path === "/refunds")!.body.get("payment_intent")).toBe("pi_refund");
      expect((await call(`/api/v1/payments/${card.id}/refund`, { staff: token, body: {} })).status).toBe(409);
    } finally {
      stripe.restore();
    }
  });

  it("keeps payment tools away from editors and other agencies", async () => {
    const a = await makeTenant();
    const b = await makeTenant();
    const { activity, departure } = await makeTrip(a.tenant.id, { price: 100 });
    const booking = await newBooking(a.tenant.slug, activity.id, departure.id, 1);
    const res = await call("/api/v1/payments/manual", { staff: b.token, body: { bookingId: booking.id, amount: 10, provider: "CASH" } });
    expect(res.status).toBe(404);
  });
});
