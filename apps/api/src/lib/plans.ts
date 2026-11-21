import type { Env } from "@/env";

export const PLAN_KEYS = ["PRO", "ENTERPRISE"] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];
export type SelfServePlan = Exclude<PlanKey, "ENTERPRISE">;
export const SELF_SERVE_PLANS: SelfServePlan[] = ["PRO"];
export type BillingInterval = "monthly" | "annual";

/** Plans sold before there was a single one. Still in the database; all of them are Pro now. */
export const LEGACY_PLAN_KEYS = ["STARTER", "GROWTH", "SCALE"] as const;

/** Maps any stored plan value (including legacy ones) to a current plan key. */
export function canonicalPlan(value: string | null | undefined): PlanKey {
  return value === "ENTERPRISE" ? "ENTERPRISE" : "PRO";
}

export type PlanLimits = { trips: number; posts: number; staff: number; storageBytes: number; apiAccess: boolean };

const GB = 1024 ** 3;

/** The one place plan limits live. The dashboard reads these through GET /tenant/billing. */
export const PLANS: Record<PlanKey, { name: string; tagline: string; limits: PlanLimits }> = {
  PRO: {
    name: "Pro",
    tagline: "Everything an agency needs to run its trips and website.",
    limits: { trips: Infinity, posts: Infinity, staff: Infinity, storageBytes: 25 * GB, apiAccess: true },
  },
  ENTERPRISE: {
    name: "Custom",
    tagline: "We build and run it with you. Quoted per project.",
    limits: { trips: Infinity, posts: Infinity, staff: Infinity, storageBytes: Infinity, apiAccess: true },
  },
};

export const EXPIRED_LIMITS: PlanLimits = { trips: 0, posts: 0, staff: 0, storageBytes: 0, apiAccess: false };

/** Length of the paid trial ($2.99, a one-time Dodo product: DODO_TRIAL_PRODUCT_ID). */
export const TRIAL_DAYS = 7;

/** After a paid subscription lapses, the website API keeps answering this long. The dashboard locks right away. */
export const API_GRACE_DAYS = 15;

/** Dodo product id for a self-serve plan + interval, or undefined when that combination isn't sold. */
export function productIdFor(env: Env, plan: SelfServePlan, interval: BillingInterval): string | undefined {
  if (plan !== "PRO") return undefined;
  // GROWTH ids are read as a fallback so an existing local/prod setup keeps working until renamed.
  const id =
    interval === "monthly"
      ? (env.DODO_PRO_MONTHLY_PRODUCT_ID ?? env.DODO_GROWTH_MONTHLY_PRODUCT_ID)
      : (env.DODO_PRO_ANNUAL_PRODUCT_ID ?? env.DODO_GROWTH_ANNUAL_PRODUCT_ID);
  return id && !id.includes("replace") ? id : undefined;
}

/** Every product id ever sold as a subscription, so webhooks for older subscriptions still resolve. */
function legacyProductIds(env: Env): Record<string, BillingInterval> {
  const entries: Array<[string | undefined, BillingInterval]> = [
    [env.DODO_STARTER_MONTHLY_PRODUCT_ID, "monthly"],
    [env.DODO_STARTER_ANNUAL_PRODUCT_ID, "annual"],
    [env.DODO_GROWTH_MONTHLY_PRODUCT_ID, "monthly"],
    [env.DODO_GROWTH_ANNUAL_PRODUCT_ID, "annual"],
    [env.DODO_SCALE_MONTHLY_PRODUCT_ID, "monthly"],
    [env.DODO_SCALE_ANNUAL_PRODUCT_ID, "annual"],
  ];
  return Object.fromEntries(entries.filter(([id]) => id && !id.includes("replace")).map(([id, i]) => [id as string, i]));
}

export function planForProductId(env: Env, productId: string): { plan: SelfServePlan; interval: BillingInterval } | null {
  for (const interval of ["monthly", "annual"] as const) {
    if (productIdFor(env, "PRO", interval) === productId) return { plan: "PRO", interval };
  }
  const legacy = legacyProductIds(env)[productId];
  return legacy ? { plan: "PRO", interval: legacy } : null;
}

/** Lowercase, and strip "+tag" and Gmail dots, so one person can't take the trial twice. */
export function normalizeEmail(email: string) {
  const [local, domain = ""] = email.trim().toLowerCase().split("@");
  let base = local.split("+")[0];
  if (domain === "gmail.com" || domain === "googlemail.com") base = base.replace(/\./g, "");
  return `${base}@${domain === "googlemail.com" ? "gmail.com" : domain}`;
}
