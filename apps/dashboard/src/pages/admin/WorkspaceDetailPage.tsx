import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Loader2, Mail, RefreshCw } from "lucide-react";
import { api, ApiClientError } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { confirmDialog } from "@/components/confirm";
import { Field } from "@/components/form";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PLAN_NAMES, type PlanKey } from "@/pages/billing/billing";
import {
  AUDIT_LABELS,
  fromDateInput,
  toDateInput,
  workspaceState,
  type SetupLink,
  type WorkspaceDetail,
} from "./admin-api";
import { SetupLinkPanel } from "./handover";

export function WorkspaceDetailPage() {
  const id = Number(useParams().id);
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["platform", "tenant", id],
    queryFn: () => api<WorkspaceDetail>(`/platform/tenants/${id}`),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["platform"] });

  const update = useMutation({
    meta: { success: "Saved" },
    mutationFn: (body: Record<string, unknown>) => api(`/platform/tenants/${id}`, { method: "PATCH", body }),
    onSuccess: refresh,
  });

  const openAsOwner = useMutation({
    mutationFn: () => api(`/platform/tenants/${id}/impersonate`, { body: {} }),
    // The workspace session cookie is now set for this browser; the dashboard opens as the owner.
    // The banner there links back here.
    onSuccess: () => window.location.assign("/"),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (isError || !data) {
    return <p className="text-sm text-destructive">Couldn't load this workspace.</p>;
  }

  const t = data.tenant;
  const suspended = t.status === "SUSPENDED";

  return (
    <div>
      <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2 text-muted-foreground">
        <Link to="/admin/workspaces">
          <ArrowLeft />
          Workspaces
        </Link>
      </Button>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{t.companyName ?? t.slug}</h1>
            <StatusBadge kind="workspace" status={workspaceState(t)} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-mono">{t.slug}</span> · created {formatDate(t.createdAt)}
            {t.createdByAdminId ? " by the Wepilo team" : " by self sign-up"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={suspended || openAsOwner.isPending}
            onClick={() =>
              confirmDialog(
                {
                  title: "Open as owner?",
                  description:
                    "This browser signs into the workspace as its owner for one hour. Anything you change is saved as the owner. The visit is logged.",
                  confirmLabel: "Open workspace",
                  destructive: false,
                },
                () => openAsOwner.mutate(),
              )
            }
          >
            <ExternalLink />
            Open as owner
          </Button>
          <Button
            variant={suspended ? "default" : "outline"}
            className={suspended ? undefined : "text-destructive hover:text-destructive"}
            disabled={update.isPending}
            onClick={() =>
              confirmDialog(
                suspended
                  ? { title: "Reactivate workspace?", description: "Staff can sign in again and the website API resumes.", confirmLabel: "Reactivate", destructive: false }
                  : {
                      title: "Suspend workspace?",
                      description: "Everyone is signed out, nobody can sign in, and the website API stops answering. Content is kept.",
                      confirmLabel: "Suspend",
                    },
                () => update.mutate({ status: suspended ? "ACTIVE" : "SUSPENDED" }),
              )
            }
          >
            {suspended ? "Reactivate" : "Suspend"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="space-y-6">
          <HandoverCard data={data} onChanged={refresh} />
          <PlanCard data={data} pending={update.isPending} onSave={(body) => update.mutate(body)} />
          <Panel title="Staff" description={`${data.staff.length} login${data.staff.length === 1 ? "" : "s"}`}>
            <ul className="divide-y">
              {data.staff.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{s.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{s.email}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {s.role.charAt(0) + s.role.slice(1).toLowerCase()}
                    {!s.isActive && " · disabled"}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Usage">
            <dl className="grid grid-cols-2 gap-4">
              {(
                [
                  ["Trips", data.usage.trips],
                  ["Posts", data.usage.posts],
                  ["Bookings", data.usage.bookings],
                  ["Staff", data.usage.staff],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="mt-0.5 text-lg font-semibold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          </Panel>
          <Panel title="Activity" description="What platform admins did here.">
            {data.log.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing yet.</p>
            ) : (
              <ol className="space-y-3">
                {data.log.map((entry) => (
                  <li key={entry.id} className="text-sm">
                    <p className="font-medium">{AUDIT_LABELS[entry.action] ?? entry.action}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.admin?.name ?? "Removed admin"} · {new Date(entry.createdAt).toLocaleString()}
                    </p>
                    {entry.detail && entry.action === "workspace.updated" && (
                      <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                        {Object.keys(entry.detail).join(", ")}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function HandoverCard({ data, onChanged }: { data: WorkspaceDetail; onChanged: () => void }) {
  const owner = data.owner;
  const [link, setLink] = useState<SetupLink | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(owner?.name ?? "");
  const [email, setEmail] = useState(owner?.email ?? "");
  const [error, setError] = useState<string | null>(null);

  const issue = useMutation({
    mutationFn: (sendEmail: boolean) => api<SetupLink>(`/platform/tenants/${data.tenant.id}/setup-link`, { body: { sendEmail } }),
    onSuccess: (r) => {
      setLink(r);
      onChanged();
    },
  });
  const saveOwner = useMutation({
    meta: { success: "Owner updated" },
    mutationFn: () => api(`/platform/tenants/${data.tenant.id}`, { method: "PATCH", body: { ownerName: name, ownerEmail: email } }),
    onSuccess: () => {
      setEditing(false);
      setLink(null);
      onChanged();
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : "Something went wrong"),
  });

  const status = data.pendingSetupUntil
    ? `Waiting for the client to set a password. The current link expires ${formatDate(data.pendingSetupUntil)}.`
    : "No open setup link. If the client hasn't signed in yet, issue a new one.";

  return (
    <Panel
      title="Owner & handover"
      description="The client signs in with this email after setting a password through a setup link."
      action={
        owner &&
        !editing && (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            Edit owner
          </Button>
        )
      }
    >
      {!owner ? (
        <p className="text-sm text-destructive">This workspace has no owner login.</p>
      ) : editing ? (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            saveOwner.mutate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="owner-name" required>
              <Input id="owner-name" required value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Email" htmlFor="owner-email" required hint="Also changes the address they sign in with.">
              <Input id="owner-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={saveOwner.isPending}>
              {saveOwner.isPending && <Loader2 className="animate-spin" />}
              Save owner
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="text-sm">
            <p className="font-medium">{owner.name}</p>
            <p className="text-muted-foreground">{owner.email}</p>
          </div>
          <p className="text-sm text-muted-foreground">{status}</p>
          {link && <SetupLinkPanel link={link} ownerEmail={owner.email} />}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={issue.isPending} onClick={() => issue.mutate(false)}>
              <RefreshCw />
              New setup link
            </Button>
            <Button variant="outline" size="sm" disabled={issue.isPending} onClick={() => issue.mutate(true)}>
              <Mail />
              Email new link to owner
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">A new link replaces the old one. Using it also resets the owner's password.</p>
        </div>
      )}
    </Panel>
  );
}

function PlanCard({
  data,
  pending,
  onSave,
}: {
  data: WorkspaceDetail;
  pending: boolean;
  onSave: (body: Record<string, unknown>) => void;
}) {
  const t = data.tenant;
  const [plan, setPlan] = useState<PlanKey>(t.plan);
  const [endDate, setEndDate] = useState(toDateInput(t.planExpiresAt));
  const [noEnd, setNoEnd] = useState(t.plan === "ENTERPRISE" && !t.planExpiresAt);
  const [notes, setNotes] = useState(t.internalNotes ?? "");

  useEffect(() => {
    setPlan(t.plan);
    setEndDate(toDateInput(t.planExpiresAt));
    setNoEnd(t.plan === "ENTERPRISE" && !t.planExpiresAt);
    setNotes(t.internalNotes ?? "");
  }, [t.plan, t.planExpiresAt, t.internalNotes]);

  const openEnded = plan === "ENTERPRISE" && noEnd;
  const planChanged = plan !== t.plan || (openEnded ? t.planExpiresAt !== null : endDate !== toDateInput(t.planExpiresAt));
  const notesChanged = notes !== (t.internalNotes ?? "");
  const liveSubscription = t.subscription?.hasPaidSubscription && t.subscription.status !== "CANCELED" && t.subscription.status !== "EXPIRED";

  const save = () => {
    const body: Record<string, unknown> = {};
    if (planChanged) {
      body.plan = plan;
      body.planExpiresAt = openEnded ? null : fromDateInput(endDate);
    }
    if (notesChanged) body.internalNotes = notes;
    const run = () => onSave(body);
    if (planChanged && liveSubscription) {
      confirmDialog(
        {
          title: "This workspace pays through Dodo",
          description:
            "Setting the plan by hand switches it to a managed plan, but their Dodo subscription keeps billing. Cancel it in Dodo first, or the next renewal will take over again.",
          confirmLabel: "Set plan anyway",
        },
        run,
      );
    } else run();
  };

  const billingLine =
    t.billingMode === "MANUAL"
      ? "Managed by Wepilo: no checkout, no automatic renewal."
      : t.subscription?.hasPaidSubscription
        ? `Self-serve via Dodo · ${t.subscription.interval ?? ""} subscription, ${t.subscription.status.toLowerCase().replace("_", " ")}.`
        : "Self-serve: the agency pays through checkout.";

  return (
    <Panel title="Plan & access" description={billingLine}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Plan">
            <Select value={plan} onValueChange={(v) => setPlan(v as PlanKey)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PLAN_NAMES) as PlanKey[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {PLAN_NAMES[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Access until" htmlFor="plan-end">
            <Input
              id="plan-end"
              type="date"
              required={!openEnded}
              disabled={openEnded}
              value={openEnded ? "" : endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </Field>
        </div>
        {plan === "ENTERPRISE" && (
          <label className="flex items-center gap-3 text-sm">
            <Switch checked={noEnd} onCheckedChange={setNoEnd} />
            No end date
          </label>
        )}
        <Field label="Internal notes" htmlFor="plan-notes" hint="Only Wepilo admins see this.">
          <Textarea id="plan-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={pending || (!planChanged && !notesChanged)}>
            {pending && <Loader2 className="animate-spin" />}
            Save
          </Button>
          {planChanged && <span className="text-xs text-muted-foreground">Saving sets this as a managed plan.</span>}
        </div>
      </form>
    </Panel>
  );
}

function Panel({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-card">
      <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}
