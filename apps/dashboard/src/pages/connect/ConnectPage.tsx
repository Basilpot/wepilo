import { useState } from "react";
import { Navigate, useLocation, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Mountain, ShieldCheck, X } from "@/components/icons";
import { api, ApiClientError } from "@/lib/api";
import { useSession } from "@/App";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type ConnectRequest = {
  client: { name: string; uri: string | null; logo: string | null };
  redirectHost: string;
  staff: { name: string; email: string; role: string };
  companyName: string;
};

const CAN = [
  "See what needs you today: new inquiries, pending bookings and upcoming departures",
  "Read your trips, departures, bookings and inquiries",
  "Change an inquiry's status, and confirm, complete or cancel bookings",
  "Add or edit departure dates",
  "Create trips and blog posts as hidden drafts for you to review",
  "Help a website builder connect your public website to Wepilo",
];
const CANNOT = [
  "Publish or delete anything",
  "Email or message travellers",
  "See or change billing, staff logins or API keys",
];

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-muted/40 px-4 py-10">
      <div className="mb-6 flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-pill">
          <Mountain className="size-4" />
        </span>
        <span className="text-sm font-semibold tracking-tight">Wepilo</span>
      </div>
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-[0_24px_48px_-24px_rgb(0_0_0/0.25)] sm:p-8">{children}</div>
    </div>
  );
}

/**
 * Approval screen for connecting an AI app (Claude, ChatGPT, Lovable, Base44…) to this workspace.
 * The API parks the OAuth request and sends the person here with `?request=<id>`.
 */
export function ConnectPage() {
  const [params] = useSearchParams();
  const location = useLocation();
  const requestId = params.get("request") ?? "";
  const session = useSession();
  const [done, setDone] = useState<"approved" | "denied" | null>(null);

  const request = useQuery({
    queryKey: ["connect-request", requestId],
    queryFn: () => api<ConnectRequest>(`/connect/requests/${requestId}`),
    enabled: Boolean(requestId && session.data),
    retry: false,
  });

  const decide = useMutation({
    mutationFn: (choice: "approve" | "deny") =>
      api<{ redirectTo: string }>(`/connect/requests/${requestId}/${choice}`, { method: "POST", body: {} }),
    onSuccess: (res, choice) => {
      setDone(choice === "approve" ? "approved" : "denied");
      window.location.assign(res.redirectTo);
    },
  });

  if (session.isLoading) {
    return (
      <Shell>
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="mt-3 h-4 w-full" />
        <Skeleton className="mt-8 h-40 w-full" />
      </Shell>
    );
  }
  if (!session.data) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  if (!requestId || request.isError) {
    const message =
      request.error instanceof ApiClientError
        ? request.error.message
        : "This link is missing its connection request. Start connecting again from your AI app.";
    return (
      <Shell>
        <h1 className="text-lg font-semibold tracking-tight">This connection link can't be used</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{message}</p>
        <Button asChild variant="outline" className="mt-6">
          <a href="/">Go to your dashboard</a>
        </Button>
      </Shell>
    );
  }

  if (request.isLoading || !request.data) {
    return (
      <Shell>
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="mt-3 h-4 w-full" />
        <Skeleton className="mt-8 h-40 w-full" />
      </Shell>
    );
  }

  const r = request.data;

  if (done) {
    return (
      <Shell>
        <div className="flex flex-col items-center text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            {done === "approved" ? <CheckCircle2 className="size-6 animate-pop-in" /> : <X className="size-6" />}
          </span>
          <h1 className="mt-4 text-lg font-semibold tracking-tight">
            {done === "approved" ? `Connected to ${r.client.name}` : "Connection declined"}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Taking you back to {r.client.name}…</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex items-center gap-3">
        {r.client.logo ? (
          <img src={r.client.logo} alt="" className="size-10 rounded-xl border bg-background object-contain" />
        ) : (
          <span className="flex size-10 items-center justify-center rounded-xl bg-muted text-sm font-semibold text-muted-foreground">
            {r.client.name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <h1 className="text-lg leading-snug font-semibold tracking-tight">Connect {r.client.name} to Wepilo</h1>
          <p className="truncate text-sm text-muted-foreground">Returns to {r.redirectHost}</p>
        </div>
      </div>

      <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
        {r.client.name} will work in <span className="font-medium text-foreground">{r.companyName}</span> as{" "}
        <span className="font-medium text-foreground">{r.staff.name}</span> ({r.staff.role.toLowerCase()}), and only
        with what your role allows.
      </p>

      <div className="mt-5 space-y-4 rounded-xl bg-muted/50 p-4">
        <div>
          <p className="text-sm font-semibold">It can</p>
          <ul className="mt-2 space-y-1.5">
            {CAN.map((item) => (
              <li key={item} className="flex gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold">It can't</p>
          <ul className="mt-2 space-y-1.5">
            {CANNOT.map((item) => (
              <li key={item} className="flex gap-2 text-sm text-muted-foreground">
                <X className="mt-0.5 size-4 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="mt-4 flex gap-2 text-xs leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
        Only approve if you started this from {r.client.name} yourself. You can disconnect it any time in Settings → API keys.
      </p>

      {decide.isError && (
        <p className="mt-4 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {decide.error instanceof ApiClientError ? decide.error.message : "That didn't work. Try again."}
        </p>
      )}

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" disabled={decide.isPending} onClick={() => decide.mutate("deny")}>
          Deny
        </Button>
        <Button disabled={decide.isPending} onClick={() => decide.mutate("approve")} data-sound="success">
          {decide.isPending && decide.variables === "approve" && <Loader2 className="animate-spin" />}
          Allow access
        </Button>
      </div>
    </Shell>
  );
}
