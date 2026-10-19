import type { Env } from "@/env";

export const PLAN_KEYS = ["STARTER", "GROWTH", "SCALE", "ENTERPRISE"] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];
export type SelfServePlan = Exclude<PlanKey, "ENTERPRISE">;
export const SELF_SERVE_PLANS: SelfServePlan[] = ["STARTER", "GROWTH", "SCALE"];
export type BillingInterval = "monthly" | "annual";

export type PlanLimits = { trips: number; posts: number; staff: number; storageBytes: number; apiAccess: boolean };

const GB = 1024 ** 3;

/** The one place plan limits live. The dashboard reads these through GET /tenant/billing. */
export const PLANS: Record<PlanKey, { name: string; tagline: string; limits: PlanLimits }> = {
  STARTER: {
    name: "Starter",
    tagline: "For a small agency getting its site live.",
    limits: { trips: 45, posts: 200, staff: 2, storageBytes: 5 * GB, apiAccess: true },
  },
  GROWTH: {
    name: "Growth",
    tagline: "For growing agencies selling online.",
    limits: { trips: Infinity, posts: Infinity, staff: 10, storageBytes: 25 * GB, apiAccess: true },
  },
  SCALE: {
    name: "Scale",
    tagline: "For established operators with a bigger team.",
    limits: { trips: Infinity, posts: Infinity, staff: 25, storageBytes: 100 * GB, apiAccess: true },
  },
  ENTERPRISE: {
    name: "Enterprise",
    tagline: "Custom terms.",
    limits: { trips: Infinity, posts: Infinity, staff: Infinity, storageBytes: Infinity, apiAccess: true },
  },
};

export const EXPIRED_LIMITS: PlanLimits = { trips: 0, posts: 0, staff: 0, storageBytes: 0, apiAccess: false };

export const TRIAL_DAYS = 3;

/** After a paid subscription lapses, the website API keeps answering this long. The dashboard locks right away. */
export const API_GRACE_DAYS = 15;

/** Dodo product id for a self-serve plan + interval, or undefined when that combination isn't sold. */
export function productIdFor(env: Env, plan: SelfServePlan, interval: BillingInterval): string | undefined {
  const map: Record<string, string | undefined> = {
    "STARTER:monthly": env.DODO_STARTER_MONTHLY_PRODUCT_ID,
    "STARTER:annual": env.DODO_STARTER_ANNUAL_PRODUCT_ID,
    "GROWTH:monthly": env.DODO_GROWTH_MONTHLY_PRODUCT_ID,
    "GROWTH:annual": env.DODO_GROWTH_ANNUAL_PRODUCT_ID,
    "SCALE:monthly": env.DODO_SCALE_MONTHLY_PRODUCT_ID,
    "SCALE:annual": env.DODO_SCALE_ANNUAL_PRODUCT_ID,
  };
  const id = map[`${plan}:${interval}`];
  return id && !id.includes("replace") ? id : undefined;
}

export function planForProductId(env: Env, productId: string): { plan: SelfServePlan; interval: BillingInterval } | null {
  for (const plan of SELF_SERVE_PLANS) {
    for (const interval of ["monthly", "annual"] as const) {
      if (productIdFor(env, plan, interval) === productId) return { plan, interval };
    }
  }
  return null;
}

/** Lowercase, and strip "+tag" and Gmail dots, so one person can't take the trial twice. */
export function normalizeEmail(email: string) {
  const [local, domain = ""] = email.trim().toLowerCase().split("@");
  let base = local.split("+")[0];
  if (domain === "gmail.com" || domain === "googlemail.com") base = base.replace(/\./g, "");
  return `${base}@${domain === "googlemail.com" ? "gmail.com" : domain}`;
}
