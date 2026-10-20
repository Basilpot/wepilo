import { useMutation, useQuery } from "@tanstack/react-query";
import { api, toastApiError } from "@/lib/api";

export type PlanKey = "STARTER" | "GROWTH" | "SCALE" | "ENTERPRISE";
export type SelfServePlan = Exclude<PlanKey, "ENTERPRISE">;
export type BillingInterval = "monthly" | "annual";
export type AccessState = "UNPAID" | "TRIAL" | "ACTIVE" | "PAST_DUE" | "EXPIRED";

/** Mirrors `Access` in apps/api/src/lib/billing.ts. */
export type Access = {
  state: AccessState;
  locked: boolean;
  plan: PlanKey;
  endsAt: string | null;
  trialAvailable: boolean;
  cancelAtPeriodEnd: boolean;
  /** Plan set by the Wepilo team; no self-serve billing. */
  managed: boolean;
  apiUntil: string | null;
};

export type Price = { amount: number; currency: string } | null;

export type PlanInfo = {
  key: SelfServePlan;
  name: string;
  tagline: string;
  limits: { trips: number | null; posts: number | null; staff: number | null; storageBytes: number | null; apiAccess: boolean };
  /** null = not sold on that interval */
  intervals: Record<BillingInterval, { price: Price } | null>;
};

export type Billing = {
  access: Access;
  subscription: {
    status: string;
    plan: PlanKey;
    interval: BillingInterval | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    hasPaidSubscription: boolean;
  } | null;
  trial: { days: number; price: Price };
  plans: PlanInfo[];
};

export const PLAN_NAMES: Record<PlanKey, string> = {
  STARTER: "Starter",
  GROWTH: "Growth",
  SCALE: "Scale",
  ENTERPRISE: "Enterprise",
};

/** Plan highlighted as the default choice. */
export const RECOMMENDED_PLAN: SelfServePlan = "GROWTH";

export function useBilling() {
  return useQuery({ queryKey: ["billing"], queryFn: () => api<Billing>("/tenant/billing") });
}

const goTo = (r: { url?: string }) => {
  if (r.url) window.location.href = r.url;
};

export function useStartTrial() {
  return useMutation({
    mutationFn: (plan: SelfServePlan) => api<{ url: string }>("/tenant/billing/trial", { body: { plan } }),
    onSuccess: goTo,
    onError: (err) => toastApiError(err, "Couldn't open checkout. Try again."),
  });
}

export function useCheckout(onChanged?: () => void) {
  return useMutation({
    mutationFn: (input: { plan: SelfServePlan; interval: BillingInterval }) =>
      api<{ url?: string; changed?: boolean }>("/tenant/billing/checkout", { body: input }),
    onSuccess: (r) => (r.changed ? onChanged?.() : goTo(r)),
    onError: (err) => toastApiError(err, "Couldn't open checkout. Try again."),
  });
}

export function useBillingPortal() {
  return useMutation({
    mutationFn: () => api<{ url: string }>("/tenant/billing/portal", { body: {} }),
    onSuccess: goTo,
    onError: (err) => toastApiError(err, "Couldn't open billing. Try again."),
  });
}

export function formatPrice(price: Price, interval?: BillingInterval) {
  if (!price) return null;
  const amount = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: price.currency,
    maximumFractionDigits: price.amount % 1 === 0 ? 0 : 2,
  }).format(price.amount);
  return interval ? `${amount}/${interval === "annual" ? "yr" : "mo"}` : amount;
}

export function planFeatures(plan: PlanInfo, opts: { trial?: boolean } = {}) {
  const l = plan.limits;
  const gb = (b: number | null) => (b === null ? "Unlimited storage" : `${Math.round(b / 1024 ** 3)} GB media storage`);
  return [
    l.trips === null ? "Unlimited trips" : `Up to ${l.trips} trips`,
    l.posts === null ? "Unlimited posts and pages" : `${l.posts} posts`,
    l.staff === null ? "Unlimited staff logins" : `${l.staff} staff login${l.staff === 1 ? "" : "s"}`,
    gb(l.storageBytes),
    opts.trial ? "Website API unlocks with a paid plan" : "Website API access",
  ];
}

export function daysLeft(iso: string | null) {
  if (!iso) return null;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}
