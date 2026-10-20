import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Copy, KeyRound, Loader2, Power, Trash2, UserPlus, Users2 } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/status-badge";
import { useSession } from "@/App";
import { useLeaveGuard } from "@/hooks/use-leave-guard";
import { PageHeader } from "@/components/PageHeader";
import { InfoCard } from "@/components/atoms";
import { PlanPicker } from "@/pages/billing/PlanPicker";
import { PLAN_NAMES, useBilling, useBillingPortal } from "@/pages/billing/billing";
import { Field, FormDialog } from "@/components/form";
import { ImageField } from "@/components/image-field";
import { DataTable, RowActions, type Column } from "@/components/data-table";
import { confirmDialog } from "@/components/confirm";
import { useErrorMessage } from "@/pages/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type StaffMember = {
  id: number;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
};

const TABS = [
  { value: "profile", label: "Business profile" },
  { value: "staff", label: "Staff logins" },
  { value: "api-keys", label: "API keys" },
  { value: "billing", label: "Billing" },
] as const;

const ROLES = [
  { value: "ADMIN", label: "Admin", hint: "Everything except billing and API keys." },
  { value: "MANAGER", label: "Manager", hint: "Trips, departures, bookings and content." },
  { value: "EDITOR", label: "Editor", hint: "Posts, pages and media only." },
];

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

/** Two-column settings row: what it is on the left, the controls on the right. */
function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-x-10 gap-y-4 border-b py-8 first:pt-2 last:border-b-0 md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="min-w-0 max-w-2xl space-y-5">{children}</div>
    </section>
  );
}

function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() =>
        navigator.clipboard.writeText(value).then(
          () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          },
          () => toast.error("Couldn't copy. Select the text and copy it manually."),
        )
      }
    >
      {copied ? <Check /> : <Copy />}
      {copied ? "Copied" : label}
    </Button>
  );
}

// ── Profile ─────────────────────────────────────────────────────────────────

type ProfileForm = {
  companyName: string;
  companyLogo: string;
  website: string;
  companyDescription: string;
  phone: string;
  address: string;
};

function ProfileTab() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const tenant = session?.tenant;
  const initial: ProfileForm = {
    companyName: tenant?.companyName ?? "",
    companyLogo: tenant?.companyLogo ?? "",
    website: tenant?.website ?? "",
    companyDescription: tenant?.companyDescription ?? "",
    phone: tenant?.phone ?? "",
    address: tenant?.address ?? "",
  };
  const [form, setForm] = useState<ProfileForm>(initial);
  const baseline = JSON.stringify(initial);

  useEffect(() => {
    setForm(JSON.parse(baseline) as ProfileForm);
  }, [baseline]);

  const dirty = JSON.stringify(form) !== baseline;
  useLeaveGuard(dirty);
  const set = (key: keyof ProfileForm, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const save = useMutation({
    meta: { success: "Business profile saved" },
    mutationFn: () =>
      api("/tenant/me", {
        body: {
          companyName: form.companyName.trim() || undefined,
          companyLogo: form.companyLogo || null,
          website: form.website.trim() || null,
          companyDescription: form.companyDescription.trim() || null,
          phone: form.phone.trim() || null,
          address: form.address.trim() || null,
        },
        method: "PATCH",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["session"] }),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <SettingsSection title="Brand" description="Your name and logo appear on your site, in emails and in this dashboard.">
        <Field label="Business name" htmlFor="companyName" required>
          <Input id="companyName" value={form.companyName} onChange={(e) => set("companyName", e.target.value)} />
        </Field>
        <Field label="Logo" hint="Square or wide PNG/SVG with a transparent background works best.">
          <ImageField shape="square" label="Upload logo" value={form.companyLogo} onChange={(url) => set("companyLogo", url)} />
        </Field>
        <Field label="About your business" htmlFor="desc" hint="A short paragraph for your site's footer and About section.">
          <Textarea id="desc" rows={4} value={form.companyDescription} onChange={(e) => set("companyDescription", e.target.value)} />
        </Field>
      </SettingsSection>

      <SettingsSection title="Contact" description="How travellers reach you. Shown on your site and in booking emails.">
        <Field label="Website" htmlFor="website">
          <Input id="website" type="url" value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://www.example.com" />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Phone" htmlFor="phone">
            <Input id="phone" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+1 555 0100" />
          </Field>
          <Field label="Office address" htmlFor="address">
            <Input id="address" value={form.address} onChange={(e) => set("address", e.target.value)} />
          </Field>
        </div>
      </SettingsSection>

      <div
        className={cn(
          "sticky bottom-4 z-10 mt-2 flex items-center justify-between gap-3 rounded-lg border bg-background/95 px-4 py-3 shadow-lg backdrop-blur transition-all",
          dirty ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0",
        )}
        aria-hidden={!dirty}
      >
        <span className="text-sm text-muted-foreground">You have unsaved changes</span>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={() => setForm(JSON.parse(baseline) as ProfileForm)} disabled={save.isPending}>
            Discard
          </Button>
          <Button type="submit" disabled={save.isPending || !form.companyName.trim()}>
            {save.isPending && <Loader2 className="animate-spin" />}
            Save changes
          </Button>
        </div>
      </div>
    </form>
  );
}

// ── Staff ───────────────────────────────────────────────────────────────────

function StaffTab() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "EDITOR" });
  const [error, setError] = useState<string | null>(null);
  const errorMessage = useErrorMessage();
  const { data: session } = useSession();
  const isOwner = session?.staff.role === "OWNER";

  const { data, isLoading } = useQuery({
    queryKey: ["staff"],
    queryFn: () => api<{ data: StaffMember[] }>("/tenant/staff"),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["staff"] });

  const create = useMutation({
    meta: { success: "Staff login created" },
    mutationFn: () => api("/tenant/staff", { body: form }),
    onSuccess: () => {
      invalidate();
      setDialogOpen(false);
      setForm({ name: "", email: "", password: "", role: "EDITOR" });
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const update = useMutation({
    meta: { success: "Staff login updated" },
    mutationFn: ({ id, body }: { id: number; body: Record<string, unknown> }) =>
      api(`/tenant/staff/${id}`, { body, method: "PATCH" }),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    meta: { success: "Staff login removed" },
    mutationFn: (id: number) => api(`/tenant/staff/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const columns: Column<StaffMember>[] = [
    {
      key: "name",
      header: "Person",
      cell: (m) => (
        <div className="flex items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
            {m.name.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium">
              {m.name}
              {m.id === session?.staff.id && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(you)</span>}
            </p>
            <p className="truncate text-xs text-muted-foreground">{m.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      cell: (m) =>
        m.role === "OWNER" ? (
          <span className="text-sm">Owner</span>
        ) : (
          <div onClick={(e) => e.stopPropagation()}>
            <Select value={m.role} disabled={!isOwner} onValueChange={(role) => update.mutate({ id: m.id, body: { role } })}>
              <SelectTrigger size="sm" className="w-32" aria-label={`Role for ${m.name}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ),
    },
    {
      key: "status",
      header: "Status",
      cell: (m) => <StatusBadge kind="account" status={m.isActive ? "active" : "disabled"} />,
    },
    {
      key: "actions",
      headClassName: "w-12",
      cell: (m) =>
        isOwner && m.role !== "OWNER" ? (
          <RowActions
            actions={[
              {
                label: m.isActive ? "Disable login" : "Enable login",
                icon: Power,
                onSelect: () => update.mutate({ id: m.id, body: { isActive: !m.isActive } }),
              },
              {
                label: "Remove",
                icon: Trash2,
                variant: "destructive",
                separatorBefore: true,
                onSelect: () =>
                  confirmDialog(
                    { title: "Remove staff login?", description: `${m.name} will no longer be able to sign in.`, confirmLabel: "Remove" },
                    () => remove.mutate(m.id),
                  ),
              },
            ]}
          />
        ) : null,
    },
  ];

  return (
    <>
      <SettingsSection
        title="Staff logins"
        description="People who can sign in to this dashboard. Each person gets their own login."
      >
        <div className="flex justify-end">
          {isOwner && (
            <Button
              size="sm"
              onClick={() => {
                setError(null);
                setDialogOpen(true);
              }}
            >
              <UserPlus />
              Add staff login
            </Button>
          )}
        </div>
        <DataTable
          columns={columns}
          rows={data?.data ?? []}
          getRowId={(m) => m.id}
          isLoading={isLoading}
          emptyIcon={Users2}
          emptyTitle="Only you so far"
          emptyHint="Give teammates their own login instead of sharing yours."
        />
      </SettingsSection>
      <SettingsSection title="Roles" description="What each role can do.">
        <dl className="divide-y rounded-lg border">
          <div className="flex gap-4 px-4 py-3 text-sm">
            <dt className="w-24 shrink-0 font-medium">Owner</dt>
            <dd className="text-muted-foreground">Everything, including billing, API keys and staff.</dd>
          </div>
          {ROLES.map((r) => (
            <div key={r.value} className="flex gap-4 px-4 py-3 text-sm">
              <dt className="w-24 shrink-0 font-medium">{r.label}</dt>
              <dd className="text-muted-foreground">{r.hint}</dd>
            </div>
          ))}
        </dl>
      </SettingsSection>

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Add staff login"
        description="They'll sign in with this email and password. Share the password privately."
        onSubmit={() => create.mutate()}
        pending={create.isPending}
        submitLabel="Create login"
      >
        {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <Field label="Name" htmlFor="staff-name" required>
          <Input id="staff-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </Field>
        <Field label="Email" htmlFor="staff-email" required>
          <Input id="staff-email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
        </Field>
        <Field label="Temporary password" htmlFor="staff-pass" required hint="At least 8 characters.">
          <Input
            id="staff-pass"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          />
        </Field>
        <Field label="Role">
          <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{ROLES.find((r) => r.value === form.role)?.hint}</p>
        </Field>
      </FormDialog>
    </>
  );
}

// ── API keys ────────────────────────────────────────────────────────────────

function ApiKeysTab() {
  const queryClient = useQueryClient();
  const [newKey, setNewKey] = useState<string | null>(null);
  const { data: session } = useSession();
  const inTrial = session?.access?.state === "TRIAL";

  const { data: apiKeyStatus, isLoading } = useQuery({
    queryKey: ["api-key"],
    queryFn: () => api<{ configured: boolean }>("/tenant/api-key"),
  });

  const createApiKey = useMutation({
    meta: { success: "API key created" },
    mutationFn: () => api<{ apiKey: string }>("/tenant/api-key", { body: {} }),
    onSuccess: (result) => {
      setNewKey(result.apiKey);
      void queryClient.invalidateQueries({ queryKey: ["api-key"] });
    },
  });

  const revokeApiKey = useMutation({
    meta: { success: "API key revoked" },
    mutationFn: () => api("/tenant/api-key", { method: "DELETE" }),
    onSuccess: () => {
      setNewKey(null);
      void queryClient.invalidateQueries({ queryKey: ["api-key"] });
    },
  });

  return (
    <>
      <SettingsSection
        title="Content API key"
        description={
          <>
            Lets your website read trips, posts and pages. Send it in the{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">x-api-key</code> header. Included with every paid plan (not during the trial).
          </>
        }
      >
        {newKey ? (
          <div className="space-y-3 rounded-lg border border-amber-300/60 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
              Copy this key now. For your security it won't be shown again.
            </p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-md border bg-background px-3 py-2 font-mono text-xs">{newKey}</code>
              <CopyButton value={newKey} />
            </div>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <KeyRound className="size-4" />
            </span>
            <div>
              <p className="text-sm font-medium">Content API key</p>
              <p className="text-xs text-muted-foreground">
                {isLoading ? "Checking…" : apiKeyStatus?.configured ? "Active" : "Not created yet"}
              </p>
            </div>
          </div>
          {apiKeyStatus?.configured ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={createApiKey.isPending}
                onClick={() =>
                  confirmDialog(
                    {
                      title: "Replace API key?",
                      description: "A new key is created and the current one stops working right away. Update your site with the new key.",
                      confirmLabel: "Replace key",
                    },
                    () => createApiKey.mutate(),
                  )
                }
              >
                Replace
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={revokeApiKey.isPending}
                onClick={() =>
                  confirmDialog(
                    {
                      title: "Revoke API key?",
                      description: "Your website will stop loading content from this workspace until you add a new key.",
                      confirmLabel: "Revoke",
                    },
                    () => revokeApiKey.mutate(),
                  )
                }
              >
                Revoke
              </Button>
            </div>
          ) : (
            <Button size="sm" onClick={() => createApiKey.mutate()} disabled={createApiKey.isPending || isLoading || inTrial}>
              {createApiKey.isPending && <Loader2 className="animate-spin" />}
              Create key
            </Button>
          )}
        </div>
        {inTrial && (
          <InfoCard
            title="API access starts with a paid plan"
            info="Your trial covers the dashboard. Choose a plan in Billing to connect your website."
          />
        )}
      </SettingsSection>

    </>
  );
}

// ── Billing ─────────────────────────────────────────────────────────────────

function BillingTab() {
  const { data: session } = useSession();
  const { data, isLoading, refetch } = useBilling();
  const queryClient = useQueryClient();
  const portal = useBillingPortal();
  const canManage = session?.staff.role === "OWNER";

  const access = data?.access;
  const sub = data?.subscription;
  const planName = access ? PLAN_NAMES[access.plan] : "—";

  let summary = "";
  if (access?.managed) {
    summary = access.endsAt
      ? `Arranged with the Wepilo team · runs until ${formatDate(access.endsAt)}`
      : "Arranged with the Wepilo team · no end date";
  } else if (access && sub) {
    if (access.state === "TRIAL") {
      summary = `Trial ends ${access.endsAt ? formatDate(access.endsAt) : "soon"}. You won't be charged automatically. Choose a plan below to keep access.`;
    } else if (access.state === "PAST_DUE") {
      summary = "Your last payment failed. Update your card to keep your plan.";
    } else if (sub.cancelAtPeriodEnd && sub.currentPeriodEnd) {
      summary = `Cancelled. Access ends ${formatDate(sub.currentPeriodEnd)}.`;
    } else if (sub.currentPeriodEnd) {
      summary = `${sub.interval === "annual" ? "Annual" : "Monthly"} billing · renews ${formatDate(sub.currentPeriodEnd)}`;
    }
  }

  return (
    <>
      <SettingsSection title="Current plan" description="Your plan sets limits on trips, staff and storage.">
        {isLoading || !data ? (
          <Skeleton className="h-20 w-full" />
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-lg font-semibold tracking-tight">{planName}</p>
                {sub && <StatusBadge kind="subscription" status={sub.status} />}
              </div>
              {summary && <p className="mt-1 text-sm text-muted-foreground">{summary}</p>}
            </div>
            {sub?.hasPaidSubscription && canManage && (
              <Button variant="outline" onClick={() => portal.mutate()} disabled={portal.isPending}>
                {portal.isPending && <Loader2 className="animate-spin" />}
                Manage billing
              </Button>
            )}
          </div>
        )}
      </SettingsSection>

      {access?.managed ? (
        <SettingsSection title="Changing your plan" description="Your plan was set up with the Wepilo team.">
          <p className="text-sm text-muted-foreground">
            To change your plan, limits or end date,{" "}
            <Link className="font-medium text-foreground underline underline-offset-4" to="/support">
              contact us through Support
            </Link>
            .
          </p>
        </SettingsSection>
      ) : (
      <SettingsSection
        title={sub?.hasPaidSubscription ? "Change plan" : "Choose a plan"}
        description={
          sub?.hasPaidSubscription
            ? "Switching is prorated: you're charged or credited the difference today."
            : "Checkout opens on Dodo Payments' secure page. Plans renew automatically until you cancel."
        }
      >
        {data && (
          <PlanPicker
            billing={data}
            mode="subscribe"
            canManage={canManage}
            onChanged={() => {
              toast.success("Plan change requested. It'll show here in a moment.");
              setTimeout(() => {
                refetch();
                queryClient.invalidateQueries({ queryKey: ["session"] });
              }, 2500);
            }}
          />
        )}
        <p className="text-sm text-muted-foreground">
          Need more than 25 staff or custom terms? <Link className="font-medium text-foreground underline underline-offset-4" to="/support">Talk to us about Enterprise</Link>.
        </p>
      </SettingsSection>
      )}
    </>
  );
}

export function SettingsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const segments = location.pathname.split("/").filter(Boolean);
  const active = TABS.some((t) => t.value === segments[1]) ? segments[1] : "profile";

  return (
    <div>
      <PageHeader title="Settings" description="Your business profile, staff logins, API keys and plan." />
      <Tabs value={active} onValueChange={(value) => navigate(value === "profile" ? "/settings" : `/settings/${value}`)}>
        <TabsList variant="line" className="w-full justify-start border-b">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="flex-none px-3">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="profile" className="pt-4">
          <ProfileTab />
        </TabsContent>
        <TabsContent value="staff" className="pt-4">
          <StaffTab />
        </TabsContent>
        <TabsContent value="api-keys" className="pt-4">
          <ApiKeysTab />
        </TabsContent>
        <TabsContent value="billing" className="pt-4">
          <BillingTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
