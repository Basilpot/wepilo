import type { Env } from "@/env";

// Dodo Payments REST client (https://docs.dodopayments.com/api-reference).

export type DodoSubscription = {
  subscription_id: string;
  status: "pending" | "active" | "on_hold" | "paused" | "cancelled" | "failed" | "expired" | "past_due";
  product_id: string;
  customer: { customer_id: string; email: string };
  /** ISO date-time: end of the current paid period */
  next_billing_date: string;
  previous_billing_date: string;
  cancel_at_next_billing_date: boolean;
  cancelled_at: string | null;
  metadata: Record<string, string | number | boolean>;
};

export type DodoWebhookEvent = {
  business_id: string;
  type: string;
  timestamp: string;
  data: Record<string, unknown> & {
    payload_type?: string;
    metadata?: Record<string, string | number | boolean>;
  };
};

export class DodoError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`Dodo API ${status}: ${body.slice(0, 300)}`);
  }
}

function baseUrl(env: Env) {
  return env.DODO_ENVIRONMENT === "live_mode" ? "https://live.dodopayments.com" : "https://test.dodopayments.com";
}

async function dodo<T>(env: Env, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${baseUrl(env)}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.DODO_API_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new DodoError(res.status, await res.text());
  return (await res.json()) as T;
}

export function dodoCreateCustomer(env: Env, email: string, name?: string) {
  return dodo<{ customer_id: string }>(env, "/customers", {
    method: "POST",
    body: JSON.stringify({ email, name: name || email }),
  });
}

export function dodoCreateCheckout(
  env: Env,
  input: {
    customerId: string;
    productId: string;
    returnUrl: string;
    metadata: Record<string, string>;
    subscription: boolean;
  },
) {
  return dodo<{ session_id: string; checkout_url: string }>(env, "/checkouts", {
    method: "POST",
    body: JSON.stringify({
      product_cart: [{ product_id: input.productId, quantity: 1 }],
      customer: { customer_id: input.customerId },
      return_url: input.returnUrl,
      metadata: input.metadata,
      // Our trial is a separate $1 purchase, so a product-level trial must never start on a subscription.
      ...(input.subscription ? { subscription_data: { trial_period_days: 0 } } : {}),
    }),
  });
}

export function dodoGetSubscription(env: Env, subscriptionId: string) {
  return dodo<DodoSubscription>(env, `/subscriptions/${encodeURIComponent(subscriptionId)}`);
}

export function dodoChangePlan(env: Env, subscriptionId: string, productId: string, metadata: Record<string, string>) {
  return dodo<unknown>(env, `/subscriptions/${encodeURIComponent(subscriptionId)}/change-plan`, {
    method: "POST",
    body: JSON.stringify({
      product_id: productId,
      quantity: 1,
      proration_billing_mode: "prorated_immediately",
      on_payment_failure: "prevent_change",
      metadata,
    }),
  });
}

export function dodoCustomerPortal(env: Env, customerId: string, returnUrl: string) {
  const q = new URLSearchParams({ return_url: returnUrl });
  return dodo<{ link: string }>(env, `/customers/${encodeURIComponent(customerId)}/customer-portal/session?${q}`, {
    method: "POST",
  });
}

export type DodoPayment = {
  payment_id: string;
  status: string | null;
  subscription_id: string | null;
  metadata: Record<string, string | number | boolean>;
  customer: { customer_id: string; email: string };
  created_at: string;
};

export function dodoListPayments(env: Env, customerId: string) {
  const q = new URLSearchParams({ customer_id: customerId, status: "succeeded", page_size: "25" });
  return dodo<{ items: DodoPayment[] }>(env, `/payments?${q}`);
}

export function dodoGetProduct(env: Env, productId: string) {
  return dodo<{
    product_id: string;
    name: string;
    price: { price: number; currency: string; trial_period_days?: number; payment_frequency_interval?: string };
  }>(env, `/products/${encodeURIComponent(productId)}`);
}

// ── Webhook signatures (Standard Webhooks) ──────────────────────────────────

const TOLERANCE_SECONDS = 5 * 60;

function base64ToBytes(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes: Uint8Array) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signWebhook(secret: string, id: string, timestamp: string, body: string) {
  const keyBytes = secret.startsWith("whsec_") ? base64ToBytes(secret.slice(6)) : new TextEncoder().encode(secret);
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${timestamp}.${body}`));
  return bytesToBase64(new Uint8Array(mac));
}

/**
 * Verifies `webhook-id`, `webhook-timestamp` and `webhook-signature` (`v1,<base64>`, possibly several
 * space-separated) against the raw body.
 */
export async function verifyDodoWebhook(
  secret: string,
  headers: { id?: string; timestamp?: string; signature?: string },
  body: string,
  now = Date.now(),
): Promise<boolean> {
  const { id, timestamp, signature } = headers;
  if (!secret || !id || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(now / 1000 - ts) > TOLERANCE_SECONDS) return false;
  let expected: string;
  try {
    expected = await signWebhook(secret, id, timestamp, body);
  } catch (err) {
    console.error("DODO_WEBHOOK_SECRET is not a valid whsec_ secret", err);
    return false;
  }
  return signature
    .split(" ")
    .map((part) => part.split(",", 2))
    .some(([version, sig]) => version === "v1" && sig !== undefined && timingSafeEqual(sig, expected));
}
