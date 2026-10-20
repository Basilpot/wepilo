import { and, eq, isNotNull, isNull, lte, ne } from "drizzle-orm";
import type { Env } from "@/env";
import type { Db } from "@/db";
import * as schema from "@/db/schema";
import { sendEmail, escapeHtml, layout } from "@/lib/email";
import { dodoGetProduct, type DodoSubscription } from "@/lib/dodo";
import {
  EXPIRED_LIMITS,
  PLANS,
  PLAN_KEYS,
  SELF_SERVE_PLANS,
  TRIAL_DAYS,
  API_GRACE_DAYS,
  normalizeEmail,
  planForProductId,
  productIdFor,
  type PlanKey,
  type PlanLimits,
  type SelfServePlan,
} from "@/lib/plans";

const DAY = 24 * 60 * 60 * 1000;
/** Renewal payments land a little after next_billing_date; keep access open meanwhile. */
const RENEWAL_GRACE_MS = DAY;

export type AccessState = "UNPAID" | "TRIAL" | "ACTIVE" | "PAST_DUE" | "EXPIRED";

export type Access = {
  state: AccessState;
  /** True when the dashboard and API must be locked behind the paywall. */
  locked: boolean;
  plan: PlanKey;
  endsAt: Date | null;
  trialAvailable: boolean;
  cancelAtPeriodEnd: boolean;
  /** Plan set by the Wepilo team (enterprise / comped). The agency can't self-manage billing. */
  managed: boolean;
  /**
   * Until when the public website API (API key / tenant slug) answers. Never during the trial;
   * for paid subscriptions it runs API_GRACE_DAYS past the end of access. Null = no API.
   */
  apiUntil: Date | null;
};

type TenantBilling = Pick<schema.Tenant, "plan" | "planExpiresAt" | "trialUsedAt"> &
  Partial<Pick<schema.Tenant, "billingMode">>;
type SubscriptionBilling =
  | Pick<schema.PlatformSubscription, "status" | "cancelAtPeriodEnd" | "dodoSubscriptionId">
  | null
  | undefined;

export function accessFor(tenant: TenantBilling, sub: SubscriptionBilling, now = Date.now()): Access {
  const plan = (PLAN_KEYS as readonly string[]).includes(tenant.plan) ? (tenant.plan as PlanKey) : "STARTER";
  const managed = tenant.billingMode === "MANUAL";
  // A hand-set plan counts as paid: the website API is on and gets the same grace period.
  const paid = managed || Boolean(sub?.dodoSubscriptionId);
  const base = {
    plan,
    endsAt: tenant.planExpiresAt,
    trialAvailable: !tenant.trialUsedAt,
    cancelAtPeriodEnd: Boolean(sub?.cancelAtPeriodEnd),
    managed,
    apiUntil:
      paid && tenant.planExpiresAt ? new Date(tenant.planExpiresAt.getTime() + API_GRACE_DAYS * DAY) : null,
  };
  // Enterprise deals are set up by hand and may have no end date.
  if (plan === "ENTERPRISE" && !tenant.planExpiresAt)
    return { ...base, state: "ACTIVE", locked: false, apiUntil: new Date(8.64e15) };
  if (tenant.planExpiresAt && tenant.planExpiresAt.getTime() > now) {
    const state: AccessState = managed
      ? "ACTIVE"
      : sub?.status === "TRIALING"
        ? "TRIAL"
        : sub?.status === "PAST_DUE"
          ? "PAST_DUE"
          : "ACTIVE";
    return { ...base, state, locked: false };
  }
  return { ...base, state: tenant.trialUsedAt ? "EXPIRED" : "UNPAID", locked: true };
}

export function limitsFor(access: Access): PlanLimits {
  if (access.locked) return EXPIRED_LIMITS;
  const limits = PLANS[access.plan].limits;
  // The trial unlocks the dashboard only; the website API comes with a paid plan.
  return access.state === "TRIAL" ? { ...limits, apiAccess: false } : limits;
}

/** Can the agency's website (API key or tenant slug, no staff session) use the API right now? */
export function websiteApiOpen(access: Access, now = Date.now()) {
  return Boolean(access.apiUntil && access.apiUntil.getTime() > now && PLANS[access.plan].limits.apiAccess);
}

export async function loadAccess(db: Db, tenantId: number) {
  const [tenant, sub] = await Promise.all([
    db.query.tenants.findFirst({ where: eq(schema.tenants.id, tenantId) }),
    db.query.platformSubscriptions.findFirst({ where: eq(schema.platformSubscriptions.tenantId, tenantId) }),
  ]);
  if (!tenant) return null;
  return { tenant, subscription: sub ?? null, access: accessFor(tenant, sub) };
}

/** Has anyone (any workspace) already used the trial with this email? */
export async function trialEmailTaken(db: Db, email: string, exceptTenantId: number) {
  const row = await db.query.tenants.findFirst({
    where: and(eq(schema.tenants.trialEmail, normalizeEmail(email)), ne(schema.tenants.id, exceptTenantId)),
    columns: { id: true },
  });
  return Boolean(row);
}

// ── Applying Dodo events ────────────────────────────────────────────────────

/** $1 trial payment succeeded: unlock the chosen plan for TRIAL_DAYS. Safe to call twice. */
export async function grantTrial(
  db: Db,
  input: { tenantId: number; plan: SelfServePlan; customerId?: string; now?: number },
) {
  const now = input.now ?? Date.now();
  const tenant = await db.query.tenants.findFirst({ where: eq(schema.tenants.id, input.tenantId) });
  if (!tenant) return { applied: false, reason: "tenant not found" };
  if (tenant.trialUsedAt) return { applied: false, reason: "trial already used" };

  const endsAt = new Date(now + TRIAL_DAYS * DAY);
  const email = normalizeEmail(tenant.email);
  const emailFree = !(await trialEmailTaken(db, tenant.email, tenant.id));

  await db
    .update(schema.tenants)
    .set({
      plan: input.plan,
      planExpiresAt: endsAt,
      trialUsedAt: new Date(now),
      trialEmail: emailFree ? email : null,
      expiryNoticeSentAt: null,
      dodoCustomerId: tenant.dodoCustomerId ?? input.customerId ?? null,
      updatedAt: new Date(now),
    })
    .where(eq(schema.tenants.id, tenant.id));

  await db
    .insert(schema.platformSubscriptions)
    .values({ tenantId: tenant.id, plan: input.plan, status: "TRIALING", currentPeriodEnd: endsAt })
    .onConflictDoUpdate({
      target: schema.platformSubscriptions.tenantId,
      set: { plan: input.plan, status: "TRIALING", currentPeriodEnd: endsAt, updatedAt: new Date(now) },
    });

  return { applied: true, endsAt };
}

const STATUS_MAP: Record<DodoSubscription["status"], schema.PlatformSubscription["status"] | null> = {
  active: "ACTIVE",
  on_hold: "PAST_DUE",
  past_due: "PAST_DUE",
  cancelled: "CANCELED",
  failed: "EXPIRED",
  expired: "EXPIRED",
  paused: "EXPIRED",
  pending: null,
};

/** Mirror a Dodo subscription onto the tenant. Dodo is the source of truth. */
export async function applySubscription(
  db: Db,
  env: Env,
  tenantId: number,
  sub: DodoSubscription,
  now = Date.now(),
) {
  const status = STATUS_MAP[sub.status];
  if (!status) return { applied: false, reason: `ignored status ${sub.status}` };

  const existing = await db.query.platformSubscriptions.findFirst({
    where: eq(schema.platformSubscriptions.tenantId, tenantId),
  });
  // A late "cancelled/expired" for an old subscription must not end a newer one.
  if (existing?.dodoSubscriptionId && existing.dodoSubscriptionId !== sub.subscription_id && status !== "ACTIVE") {
    return { applied: false, reason: "event for a replaced subscription" };
  }

  const match = planForProductId(env, sub.product_id);
  const plan = match?.plan ?? (existing?.plan as SelfServePlan | undefined) ?? "STARTER";
  const periodEnd = sub.next_billing_date ? new Date(sub.next_billing_date) : null;
  const periodStart = sub.previous_billing_date ? new Date(sub.previous_billing_date) : null;

  let planExpiresAt: Date;
  if (status === "ACTIVE" || status === "PAST_DUE") {
    planExpiresAt = new Date((periodEnd?.getTime() ?? now + 30 * DAY) + RENEWAL_GRACE_MS);
  } else if (status === "CANCELED") {
    // Keep what they already paid for, nothing more.
    planExpiresAt = new Date(Math.max(now, Math.min(periodEnd?.getTime() ?? now, now + 400 * DAY)));
  } else {
    planExpiresAt = new Date(now);
  }

  const values = {
    dodoSubscriptionId: sub.subscription_id,
    dodoCustomerId: sub.customer?.customer_id ?? null,
    productId: sub.product_id,
    plan,
    interval: match?.interval ?? existing?.interval ?? null,
    status,
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: Boolean(sub.cancel_at_next_billing_date),
    updatedAt: new Date(now),
  };
  await db
    .insert(schema.platformSubscriptions)
    .values({ tenantId, ...values })
    .onConflictDoUpdate({ target: schema.platformSubscriptions.tenantId, set: values });

  const extended = status === "ACTIVE" || status === "PAST_DUE";
  const tenant = await db.query.tenants.findFirst({
    where: eq(schema.tenants.id, tenantId),
    columns: { trialUsedAt: true },
  });
  await db
    .update(schema.tenants)
    .set({
      plan,
      planExpiresAt,
      // A paying customer has no trial left to take.
      ...(tenant?.trialUsedAt ? {} : { trialUsedAt: new Date(now) }),
      // A live Dodo subscription takes over from any hand-set plan.
      ...(extended ? { expiryNoticeSentAt: null, billingMode: "SELF_SERVE" as const } : {}),
      ...(sub.customer?.customer_id ? { dodoCustomerId: sub.customer.customer_id } : {}),
      updatedAt: new Date(now),
    })
    .where(eq(schema.tenants.id, tenantId));

  return { applied: true, status, plan, planExpiresAt };
}

// ── Prices (read from Dodo, cached per isolate) ─────────────────────────────

type Price = { amount: number; currency: string } | null;
let priceCache: { at: number; prices: Record<string, Price> } | null = null;
const PRICE_TTL_MS = 10 * 60 * 1000;

export async function catalogPrices(env: Env) {
  if (priceCache && Date.now() - priceCache.at < PRICE_TTL_MS) return priceCache.prices;
  const ids = new Set<string>();
  for (const plan of SELF_SERVE_PLANS)
    for (const interval of ["monthly", "annual"] as const) {
      const id = productIdFor(env, plan, interval);
      if (id) ids.add(id);
    }
  if (env.DODO_TRIAL_PRODUCT_ID && !env.DODO_TRIAL_PRODUCT_ID.includes("replace")) ids.add(env.DODO_TRIAL_PRODUCT_ID);

  const prices: Record<string, Price> = {};
  await Promise.all(
    [...ids].map(async (id) => {
      try {
        const product = await dodoGetProduct(env, id);
        prices[id] = { amount: product.price.price / 100, currency: product.price.currency };
      } catch (err) {
        console.error("Dodo product lookup failed", id, err);
        prices[id] = null;
      }
    }),
  );
  priceCache = { at: Date.now(), prices };
  return prices;
}

// ── Expiry emails (cron) ────────────────────────────────────────────────────

/** Email owners whose trial or plan has run out. Each expiry is emailed once. */
export async function sendExpiryNotices(env: Env, db: Db, now = Date.now()) {
  const due = await db.query.tenants.findMany({
    where: and(
      isNotNull(schema.tenants.planExpiresAt),
      lte(schema.tenants.planExpiresAt, new Date(now)),
      isNotNull(schema.tenants.trialUsedAt),
      isNull(schema.tenants.expiryNoticeSentAt),
    ),
    limit: 50,
  });

  let sent = 0;
  for (const tenant of due) {
    const sub = await db.query.platformSubscriptions.findFirst({
      where: eq(schema.platformSubscriptions.tenantId, tenant.id),
    });
    const wasTrial = !sub?.dodoSubscriptionId && tenant.billingMode !== "MANUAL";
    const name = escapeHtml(tenant.companyName ?? "there");
    const billingUrl = `${env.DASHBOARD_URL}/settings/billing`;
    const subject = wasTrial ? "Your Wepilo trial has ended" : "Your Wepilo plan has ended";
    const lead = wasTrial
      ? `Your 3-day Wepilo trial for <strong>${name}</strong> has ended. Your trips, pages and settings are saved, but the dashboard and your website's API are paused until you choose a plan.`
      : `The Wepilo plan for <strong>${name}</strong> has ended ${tenant.billingMode === "MANUAL" ? "on its agreed end date" : "because the subscription wasn't renewed"}. Your content is saved and your website keeps working for ${API_GRACE_DAYS} more days, but the dashboard is paused until you renew.`;
    const html = layout(
      subject,
      `<p>${lead}</p>
       <p style="margin:24px 0;"><a href="${billingUrl}" style="background:#15803d;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:600;">Choose your plan</a></p>
       <p style="color:#64748b;font-size:13px;">Questions? Just reply to this email.</p>`,
    );

    const ok = await sendEmail({
      apiKey: env.RESEND_API_KEY,
      from: env.PLATFORM_EMAIL_FROM,
      to: tenant.email,
      subject,
      html,
    });
    // Mark as sent only on success so a Resend outage retries on the next run.
    if (ok) {
      await db
        .update(schema.tenants)
        .set({ expiryNoticeSentAt: new Date(now) })
        .where(eq(schema.tenants.id, tenant.id));
      sent++;
    }
  }
  return { due: due.length, sent };
}
