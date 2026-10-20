import { Hono } from "hono";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AppEnv } from "@/types";
import { dodoGetSubscription, verifyDodoWebhook, type DodoSubscription, type DodoWebhookEvent } from "@/lib/dodo";
import { applySubscription, grantTrial } from "@/lib/billing";
import { SELF_SERVE_PLANS, type SelfServePlan } from "@/lib/plans";

// Dodo → Wepilo. Configure in Dodo: Developer → Webhooks → https://<api>/api/v1/billing/webhook
// Events: payment.succeeded and all subscription.* events.

export const billingRoutes = new Hono<AppEnv>().post("/webhook", async (c) => {
  const body = await c.req.text();
  const webhookId = c.req.header("webhook-id");
  const valid = await verifyDodoWebhook(
    c.env.DODO_WEBHOOK_SECRET,
    { id: webhookId, timestamp: c.req.header("webhook-timestamp"), signature: c.req.header("webhook-signature") },
    body,
  );
  if (!valid || !webhookId) return c.json({ error: "Invalid signature" }, 401);

  let event: DodoWebhookEvent;
  try {
    event = JSON.parse(body) as DodoWebhookEvent;
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const db = c.get("db");
  const seen = await db.query.billingEvents.findFirst({ where: eq(schema.billingEvents.id, webhookId) });
  if (seen) return c.json({ ok: true, duplicate: true });

  const data = event.data ?? {};
  const metadata = data.metadata ?? {};
  const customerId = (data.customer as { customer_id?: string } | undefined)?.customer_id;
  const tenantId = await resolveTenant(db, metadata, customerId, data.subscription_id as string | undefined);

  let result: unknown = { ignored: true };
  if (tenantId) {
    if (event.type === "payment.succeeded" && metadata.kind === "trial") {
      const plan = SELF_SERVE_PLANS.includes(metadata.plan as SelfServePlan) ? (metadata.plan as SelfServePlan) : "STARTER";
      result = await grantTrial(db, { tenantId, plan, customerId });
    } else if (event.type.startsWith("subscription.") && data.subscription_id) {
      // Re-read from Dodo so out-of-order deliveries still land on the latest state.
      let sub: DodoSubscription;
      try {
        sub = await dodoGetSubscription(c.env, String(data.subscription_id));
      } catch (err) {
        console.error("Dodo subscription fetch failed, using webhook payload", err);
        sub = data as unknown as DodoSubscription;
      }
      result = await applySubscription(db, c.env, tenantId, sub);
    }
  } else {
    console.warn("Dodo webhook without a matching tenant", event.type, webhookId);
  }

  // Recorded after processing, so a failure above makes Dodo retry.
  await db
    .insert(schema.billingEvents)
    .values({ id: webhookId, type: event.type, tenantId: tenantId ?? null })
    .onConflictDoNothing();

  return c.json({ ok: true, result });
});

async function resolveTenant(
  db: AppEnv["Variables"]["db"],
  metadata: Record<string, unknown>,
  customerId: string | undefined,
  subscriptionId: string | undefined,
): Promise<number | null> {
  const fromMeta = Number(metadata.tenantId);
  if (Number.isInteger(fromMeta) && fromMeta > 0) {
    const t = await db.query.tenants.findFirst({ where: eq(schema.tenants.id, fromMeta), columns: { id: true } });
    if (t) return t.id;
  }
  if (subscriptionId) {
    const s = await db.query.platformSubscriptions.findFirst({
      where: eq(schema.platformSubscriptions.dodoSubscriptionId, subscriptionId),
      columns: { tenantId: true },
    });
    if (s) return s.tenantId;
  }
  if (customerId) {
    const t = await db.query.tenants.findFirst({
      where: eq(schema.tenants.dodoCustomerId, customerId),
      columns: { id: true },
    });
    if (t) return t.id;
  }
  return null;
}
