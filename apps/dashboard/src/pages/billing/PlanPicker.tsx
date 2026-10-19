import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { InfoCard } from "@/components/atoms";
import {
  RECOMMENDED_PLAN,
  formatPrice,
  planFeatures,
  useCheckout,
  useStartTrial,
  type Billing,
  type BillingInterval,
  type SelfServePlan,
} from "./billing";

/**
 * Plan cards. "trial" sells the one-off $1 trial on the chosen plan; "subscribe" sells (or switches)
 * a recurring plan.
 */
export function PlanPicker({
  billing,
  mode,
  canManage,
  onChanged,
}: {
  billing: Billing;
  mode: "trial" | "subscribe";
  canManage: boolean;
  onChanged?: () => void;
}) {
  const hasAnnual = billing.plans.some((p) => p.intervals.annual);
  const [interval, setInterval] = useState<BillingInterval>(
    billing.subscription?.interval ?? (billing.plans.some((p) => p.intervals.monthly) ? "monthly" : "annual"),
  );
  const [pending, setPending] = useState<SelfServePlan | null>(null);
  const trial = useStartTrial();
  const checkout = useCheckout(onChanged);
  const busy = trial.isPending || checkout.isPending;

  const sub = billing.subscription;
  const isCurrent = (plan: SelfServePlan) =>
    mode === "subscribe" &&
    Boolean(sub?.hasPaidSubscription) &&
    !billing.access.locked &&
    sub?.plan === plan &&
    sub?.interval === interval;
  const trialPrice = formatPrice(billing.trial.price) ?? "$1";

  if (mode === "subscribe" && !billing.plans.some((p) => p.intervals.monthly || p.intervals.annual)) {
    return (
      <InfoCard
        type="warning"
        title="Plans aren't available yet"
        info="Checkout isn't connected to the payment provider. Please contact support to choose a plan."
      />
    );
  }

  return (
    <div className="space-y-4">
      {mode === "subscribe" && hasAnnual && (
        <Tabs value={interval} onValueChange={(v) => setInterval(v as BillingInterval)}>
          <TabsList>
            <TabsTrigger value="monthly" className="px-3">Monthly</TabsTrigger>
            <TabsTrigger value="annual" className="px-3">Annual</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {billing.plans.map((plan) => {
          const offer = plan.intervals[interval];
          const recurring = formatPrice(offer?.price ?? null, interval);
          const anyRecurring =
            formatPrice(plan.intervals.monthly?.price ?? null, "monthly") ??
            formatPrice(plan.intervals.annual?.price ?? null, "annual");
          const recommended = plan.key === RECOMMENDED_PLAN;
          const current = isCurrent(plan.key);
          const unavailable = mode === "subscribe" && !offer;
          const switching = mode === "subscribe" && sub?.hasPaidSubscription && !billing.access.locked;

          return (
            <div
              key={plan.key}
              className={cn(
                "flex flex-col rounded-xl border bg-card p-5",
                recommended && "border-primary/50 ring-1 ring-primary/20",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold">{plan.name}</h3>
                {recommended && (
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">Most popular</span>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>

              <div className="mt-4">
                {mode === "trial" ? (
                  <>
                    <p className="text-2xl font-semibold tracking-tight">{trialPrice}</p>
                    <p className="text-xs text-muted-foreground">
                      for {billing.trial.days} days{anyRecurring ? `, then ${anyRecurring} if you choose to continue` : ""}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-2xl font-semibold tracking-tight">{recurring ?? (unavailable ? "—" : "See checkout")}</p>
                    <p className="text-xs text-muted-foreground">
                      {unavailable ? `Not offered ${interval}` : `Billed ${interval === "annual" ? "yearly" : "monthly"}, renews automatically`}
                    </p>
                  </>
                )}
              </div>

              <ul className="my-5 flex-1 space-y-2 text-sm">
                {planFeatures(plan, { trial: mode === "trial" }).map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    {f}
                  </li>
                ))}
              </ul>

              <Button
                variant={recommended ? "default" : "outline"}
                disabled={!canManage || busy || current || unavailable}
                onClick={() => {
                  setPending(plan.key);
                  if (mode === "trial") trial.mutate(plan.key, { onSettled: () => setPending(null) });
                  else checkout.mutate({ plan: plan.key, interval }, { onSettled: () => setPending(null) });
                }}
              >
                {pending === plan.key && busy && <Loader2 className="animate-spin" />}
                {mode === "trial"
                  ? `Try ${plan.name} for ${trialPrice}`
                  : current
                    ? "Current plan"
                    : switching
                      ? `Switch to ${plan.name}`
                      : `Choose ${plan.name}`}
              </Button>
            </div>
          );
        })}
      </div>

      {!canManage && (
        <p className="text-sm text-muted-foreground">Only the workspace owner can start a trial or change the plan.</p>
      )}
    </div>
  );
}
