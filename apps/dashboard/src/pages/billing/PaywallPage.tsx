import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, LogOut, Mountain, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { InfoCard } from "@/components/atoms";
import type { Session } from "@/App";
import { PlanPicker } from "./PlanPicker";
import { formatDate } from "@/lib/format";
import { useBilling } from "./billing";

async function signOut() {
  await api("/auth/logout", { method: "POST" }).catch(() => {});
  window.location.href = "/login";
}

function PaywallLayout({ session, children }: { session: Session; children: React.ReactNode }) {
  return (
    <div className="min-h-svh bg-muted/30">
      <header className="flex items-center justify-between border-b bg-background px-4 py-3 md:px-8">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Mountain className="size-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight">{session.tenant?.companyName ?? "Narfu"}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut}>
          <LogOut />
          Sign out
        </Button>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-10 md:py-14">{children}</main>
    </div>
  );
}

/** Shown instead of the dashboard until the workspace has paid for a trial or plan. */
export function PaywallPage({ session }: { session: Session }) {
  const { data, isLoading } = useBilling();
  const canManage = session.staff.role === "OWNER";
  const access = data?.access ?? session.access;
  const trial = Boolean(access?.trialAvailable);
  const lapsedPaid = access?.state === "EXPIRED" && data?.subscription?.hasPaidSubscription;

  const title = trial
    ? `Start your ${data?.trial.days ?? 3}-day trial`
    : lapsedPaid
      ? "Your plan has ended"
      : "Your trial has ended";
  const lead = trial
    ? "Pick the plan you want to try. You pay once, and nothing renews when the trial ends."
    : lapsedPaid
      ? "Your content is safe. Renew to get back into the dashboard."
      : "Your trips, pages and settings are saved. Choose a plan to pick up where you left off.";

  return (
    <PaywallLayout session={session}>
      <div className="mb-8 max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        <p className="mt-2 text-muted-foreground">{lead}</p>
      </div>

      {lapsedPaid && access?.apiUntil && new Date(access.apiUntil).getTime() > Date.now() && (
        <InfoCard
          className="mb-6"
          type="warning"
          title="Your website is still online"
          info={`The website API keeps working until ${formatDate(access.apiUntil)}. Renew before then to avoid downtime.`}
        />
      )}

      {isLoading || !data ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-96 rounded-xl" />
          ))}
        </div>
      ) : (
        <PlanPicker billing={data} mode={trial ? "trial" : "subscribe"} canManage={canManage} />
      )}

      {trial && (
        <ul className="mt-8 grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
          <li className="flex gap-2">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
            Full dashboard for {data?.trial.days ?? 3} days on the plan you pick.
          </li>
          <li className="flex gap-2">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
            No automatic charge afterwards. We'll email you when it ends.
          </li>
          <li className="flex gap-2">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
            Secure checkout by Dodo Payments.
          </li>
        </ul>
      )}
    </PaywallLayout>
  );
}

const POLL_MS = 2000;
const GIVE_UP_MS = 90_000;

/** Dodo sends people back here; wait for the webhook to unlock the workspace. */
export function BillingReturnPage({ session }: { session: Session }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [startedAt] = useState(() => Date.now());
  const kind = params.get("kind");
  const failed = params.get("status") === "failed" || params.get("status") === "cancelled";

  const { data } = useQuery({
    queryKey: ["session", "billing-return"],
    queryFn: async () => {
      // Ask the API to check with Dodo (works even before the webhook lands), then read the session.
      await api("/tenant/billing/confirm", { body: {} }).catch(() => {});
      return api<Session>("/auth/me");
    },
    refetchInterval: (q) => (failed || Date.now() - startedAt > GIVE_UP_MS || (q.state.data && confirmed(q.state.data, kind)) ? false : POLL_MS),
    initialData: session,
  });
  const done = data ? confirmed(data, kind) : false;
  const timedOut = !done && Date.now() - startedAt > GIVE_UP_MS;

  useEffect(() => {
    if (!done) return;
    queryClient.invalidateQueries({ queryKey: ["session"] });
    queryClient.invalidateQueries({ queryKey: ["billing"] });
    const t = setTimeout(() => navigate("/", { replace: true }), 1200);
    return () => clearTimeout(t);
  }, [done, navigate, queryClient]);

  return (
    <PaywallLayout session={session}>
      <div className="mx-auto max-w-md rounded-xl border bg-card p-8 text-center">
        {failed ? (
          <>
            <h1 className="text-lg font-semibold">Payment didn't go through</h1>
            <p className="mt-2 text-sm text-muted-foreground">No money was taken. You can try again.</p>
            <Button className="mt-6" onClick={() => navigate("/", { replace: true })}>Back to plans</Button>
          </>
        ) : done ? (
          <>
            <CheckCircle2 className="mx-auto size-10 text-primary" />
            <h1 className="mt-4 text-lg font-semibold">{kind === "trial" ? "Your trial has started" : "You're all set"}</h1>
            <p className="mt-2 text-sm text-muted-foreground">Taking you to your dashboard…</p>
          </>
        ) : timedOut ? (
          <>
            <h1 className="text-lg font-semibold">Still confirming your payment</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This can take a few minutes. Refresh this page shortly. If you were charged and it still doesn't unlock, contact support.
            </p>
            <Button className="mt-6" variant="outline" onClick={() => window.location.reload()}>Refresh</Button>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto size-8 animate-spin text-primary" />
            <h1 className="mt-4 text-lg font-semibold">Confirming your payment…</h1>
            <p className="mt-2 text-sm text-muted-foreground">This usually takes a few seconds. Keep this tab open.</p>
          </>
        )}
      </div>
    </PaywallLayout>
  );
}

function confirmed(s: Session, kind: string | null) {
  const a = s.access;
  if (!a || a.locked) return false;
  return kind === "trial" ? true : a.state === "ACTIVE" || a.state === "PAST_DUE";
}
