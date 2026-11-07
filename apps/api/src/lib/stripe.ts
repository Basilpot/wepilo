/** Minimal Stripe REST client. Uses the agency's own secret key; no SDK so it runs on Workers. */

const API = "https://api.stripe.com/v1";

export class StripeError extends Error {
  constructor(
    public status: number,
    message: string,
    public type?: string,
  ) {
    super(message);
  }
}

function form(data: Record<string, unknown>, prefix = "", out = new URLSearchParams()) {
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) value.forEach((v, i) => (typeof v === "object" ? form(v as Record<string, unknown>, `${name}[${i}]`, out) : out.append(`${name}[${i}]`, String(v))));
    else if (typeof value === "object") form(value as Record<string, unknown>, name, out);
    else out.append(name, String(value));
  }
  return out;
}

async function stripe<T>(secretKey: string, method: "GET" | "POST" | "DELETE", path: string, body?: Record<string, unknown>, idempotencyKey?: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: body ? form(body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as { error?: { message?: string; type?: string } } & T;
  if (!res.ok) throw new StripeError(res.status, json.error?.message ?? `Stripe answered ${res.status}`, json.error?.type);
  return json;
}

export type CheckoutSession = {
  id: string;
  url: string | null;
  status: "open" | "complete" | "expired";
  payment_status: "paid" | "unpaid" | "no_payment_required";
  payment_intent: string | null;
  amount_total: number | null;
  currency: string | null;
  metadata?: Record<string, string>;
};

export const stripeAccount = (key: string) =>
  stripe<{ id: string; business_profile?: { name?: string | null }; settings?: { dashboard?: { display_name?: string | null } } }>(key, "GET", "/account");

export function createCheckoutSession(
  key: string,
  input: {
    amountMinor: number;
    currency: string;
    name: string;
    description?: string;
    customerEmail?: string;
    successUrl: string;
    cancelUrl: string;
    metadata: Record<string, string>;
    idempotencyKey: string;
  },
) {
  return stripe<CheckoutSession>(
    key,
    "POST",
    "/checkout/sessions",
    {
      mode: "payment",
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      customer_email: input.customerEmail,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: input.currency.toLowerCase(),
            unit_amount: input.amountMinor,
            product_data: { name: input.name, description: input.description },
          },
        },
      ],
      metadata: input.metadata,
      payment_intent_data: { metadata: input.metadata },
      // Seats are checked again when payment lands, so a stale tab can't hold a link open for days.
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
    },
    input.idempotencyKey,
  );
}

export const getCheckoutSession = (key: string, id: string) => stripe<CheckoutSession>(key, "GET", `/checkout/sessions/${encodeURIComponent(id)}`);

export const refundPaymentIntent = (key: string, paymentIntent: string, idempotencyKey: string) =>
  stripe<{ id: string; status: string }>(key, "POST", "/refunds", { payment_intent: paymentIntent }, idempotencyKey);

export const createWebhookEndpoint = (key: string, url: string) =>
  stripe<{ id: string; secret: string }>(key, "POST", "/webhook_endpoints", {
    url,
    enabled_events: ["checkout.session.completed", "checkout.session.expired"],
  });

export const deleteWebhookEndpoint = (key: string, id: string) => stripe<{ deleted: boolean }>(key, "DELETE", `/webhook_endpoints/${encodeURIComponent(id)}`);

function hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Stripe-Signature check: HMAC-SHA256 of `${timestamp}.${body}`, constant-time, 5 minute tolerance. */
export async function verifyStripeSignature(payload: string, header: string | undefined, secret: string, now = Date.now()) {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=") as [string, string]));
  const timestamp = Number(parts.t);
  const candidates = header
    .split(",")
    .filter((kv) => kv.startsWith("v1="))
    .map((kv) => kv.slice(3));
  if (!timestamp || candidates.length === 0) return false;
  if (Math.abs(now / 1000 - timestamp) > 300) return false;
  const keyData = new TextEncoder().encode(secret);
  const key = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${payload}`)));
  return candidates.some((sig) => sig.length === expected.length && timingSafeEqual(sig, expected));
}

function timingSafeEqual(a: string, b: string) {
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Currencies Stripe counts in whole units instead of hundredths. */
const ZERO_DECIMAL = new Set(["BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF"]);

export const toMinor = (amount: number, currency: string) => Math.round(amount * (ZERO_DECIMAL.has(currency.toUpperCase()) ? 1 : 100));
export const fromMinor = (minor: number, currency: string) => minor / (ZERO_DECIMAL.has(currency.toUpperCase()) ? 1 : 100);
