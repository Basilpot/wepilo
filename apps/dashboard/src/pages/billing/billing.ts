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
    onError: (err) => toastApiError(err, "The payment page could not be opened. Please check your internet connection and try again."),
  });
}

export function useCheckout(onChanged?: () => void) {
  return useMutation({
    mutationFn: (input: { plan: SelfServePlan; interval: BillingInterval }) =>
      api<{ url?: string; changed?: boolean }>("/tenant/billing/checkout", { body: input }),
    onSuccess: (r) => (r.changed ? onChanged?.() : goTo(r)),
    onError: (err) => toastApiError(err, "The payment page could not be opened. Please check your internet connection and try again."),
  });
}

export function useBillingPortal() {
  return useMutation({
    mutationFn: () => api<{ url: string }>("/tenant/billing/portal", { body: {} }),
    onSuccess: goTo,
    onError: (err) => toastApiError(err, "Your billing page could not be opened. Please check your internet connection and try again."),
  });
}

export function formatPrice(price: Price, interval?: BillingInterval) {
  if (!price) return null;
  const amount = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: price.currency,
    maximumFractionDigits: price.amount % 1 === 0 ? 0 : 2,
  }).format(price.amount);
  return interval ? `${amount} per ${interval === "annual" ? "year" : "month"}` : amount;
}

export function planFeatures(plan: PlanInfo, opts: { trial?: boolean } = {}) {
  const l = plan.limits;
  const gb = (b: number | null) => (b === null ? "Unlimited storage for photos and files" : `${Math.round(b / 1024 ** 3)} GB of storage for photos and files`);
  return [
    l.trips === null ? "Unlimited trips" : `Up to ${l.trips} trips you can sell`,
    l.posts === null ? "Unlimited blog posts and website pages" : `Up to ${l.posts} blog posts`,
    l.staff === null ? "Unlimited staff logins" : `Up to ${l.staff} staff login${l.staff === 1 ? "" : "s"} for your team`,
    gb(l.storageBytes),
    opts.trial ? "Connect your own website (needs a paid plan)" : "Connect your own website with a developer API key",
  ];
}

export function daysLeft(iso: string | null) {
  if (!iso) return null;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}
