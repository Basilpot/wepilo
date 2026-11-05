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
  {
    value: "profile",
    label: "Business profile",
    title: "Business profile",
    description:
      "Your company name, logo, description and contact details. They appear on your public website, in the emails travellers receive, and at the top of this dashboard.",
  },
  {
    value: "staff",
    label: "Staff logins",
    title: "Staff logins",
    description:
      "Give each person on your team their own email and password for this dashboard, and choose what each person is allowed to see and change. Never share one login between several people.",
  },
  {
    value: "api-keys",
    label: "Developer API keys",
    title: "Developer API keys",
    description:
      "A secret key that lets your website load your trips, blog posts and pages from this dashboard. You only need this if you, or a web developer, are building your own website with Wepilo.",
  },
  {
    value: "billing",
    label: "Plan and billing",
    title: "Plan and billing",
    description:
      "See which plan you are on, when it renews, and change or cancel it. Payments are handled securely, so we never see your card number.",
  },
] as const;

const ROLES = [
  { value: "ADMIN", label: "Administrator", hint: "Can see and change everything except the plan and billing, and the developer API keys." },
  { value: "MANAGER", label: "Manager", hint: "Can manage trips, departure dates, customer bookings and inquiries, and all website content." },
  { value: "EDITOR", label: "Content editor", hint: "Can only write and edit blog posts, website pages and the media library. Cannot see customer bookings or business settings." },
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

function CopyButton({ value, label = "Copy to clipboard" }: { value: string; label?: string }) {
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
          () => toast.error("The text could not be copied automatically. Select it with your mouse and copy it yourself."),
        )
      }
    >
      {copied ? <Check /> : <Copy />}
      {copied ? "Copied to clipboard" : label}
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
    meta: { success: "Your business profile was saved. It is now updated on your website and in emails." },
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
      <SettingsSection title="Name, logo and description" description="Your name and logo appear on your public website, in emails to travellers, and in this dashboard.">
        <Field label="Your business name" htmlFor="companyName" required hint="Use the name travellers know you by.">
          <Input id="companyName" value={form.companyName} onChange={(e) => set("companyName", e.target.value)} />
        </Field>
        <Field label="Your logo" hint="Use a square or wide PNG or SVG picture with a transparent background for the best result.">
          <ImageField shape="square" label="Choose your logo from the media library" value={form.companyLogo} onChange={(url) => set("companyLogo", url)} />
        </Field>
        <Field label="Short description of your business" htmlFor="desc" hint="Write a short paragraph about who you are and what you offer. It is shown in your website footer and “About” section.">
          <Textarea id="desc" rows={4} value={form.companyDescription} onChange={(e) => set("companyDescription", e.target.value)} />
        </Field>
      </SettingsSection>

      <SettingsSection title="Contact details" description="How travellers can reach you. These are shown on your website and in booking emails.">
        <Field label="Your website address" htmlFor="website" hint="Type the full address, starting with https://. Used for the “Open my public website” button.">
          <Input id="website" type="url" value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://www.example.com" />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Business phone number" htmlFor="phone" hint="Include the country code.">
            <Input id="phone" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+1 555 0100" />
          </Field>
          <Field label="Office address" htmlFor="address" hint="Street, city and country.">
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
        <span className="text-sm text-muted-foreground">You have changes that are not saved yet</span>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={() => setForm(JSON.parse(baseline) as ProfileForm)} disabled={save.isPending}>
            Undo my changes
          </Button>
          <Button type="submit" disabled={save.isPending || !form.companyName.trim()}>
            {save.isPending && <Loader2 className="animate-spin" />}
            Save business profile
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
    meta: { success: "The staff login was created. Share the temporary password with them privately." },
    mutationFn: () => api("/tenant/staff", { body: form }),
    onSuccess: () => {
      invalidate();
      setDialogOpen(false);
      setForm({ name: "", email: "", password: "", role: "EDITOR" });
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const update = useMutation({
    meta: { success: "The staff login was updated." },
    mutationFn: ({ id, body }: { id: number; body: Record<string, unknown> }) =>
      api(`/tenant/staff/${id}`, { body, method: "PATCH" }),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    meta: { success: "The staff login was removed. That person can no longer sign in." },
    mutationFn: (id: number) => api(`/tenant/staff/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const columns: Column<StaffMember>[] = [
    {
      key: "name",
      header: "Team member",
      cell: (m) => (
        <div className="flex items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
            {m.name.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium">
              {m.name}
              {m.id === session?.staff.id && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(this is you)</span>}
            </p>
            <p className="truncate text-xs text-muted-foreground">{m.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "What they are allowed to do",
      cell: (m) =>
        m.role === "OWNER" ? (
          <span className="text-sm">Owner (full access)</span>
        ) : (
          <div onClick={(e) => e.stopPropagation()}>
            <Select value={m.role} disabled={!isOwner} onValueChange={(role) => update.mutate({ id: m.id, body: { role } })}>
              <SelectTrigger size="sm" className="w-48" aria-label={`Choose what ${m.name} is allowed to do`}>
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
      header: "Can sign in?",
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
                label: m.isActive ? "Turn off this login (they cannot sign in)" : "Turn this login back on",
                icon: Power,
                onSelect: () => update.mutate({ id: m.id, body: { isActive: !m.isActive } }),
              },
              {
                label: "Remove this login permanently",
                icon: Trash2,
                variant: "destructive",
                separatorBefore: true,
                onSelect: () =>
                  confirmDialog(
                    { title: `Remove the login for ${m.name}?`, description: `${m.name} will no longer be able to sign in to this dashboard. Nothing they created is deleted. If you only want to pause their access for now, choose “Turn off this login” instead.`, confirmLabel: "Yes, remove this login", cancelLabel: "No, keep it" },
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
        title="People who can sign in"
        description="Everyone listed here can sign in to this dashboard with their own email and password. Only the owner can add, change or remove logins."
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
              Add a staff login
            </Button>
          )}
        </div>
        <DataTable
          columns={columns}
          rows={data?.data ?? []}
          getRowId={(m) => m.id}
          isLoading={isLoading}
          emptyIcon={Users2}
          emptyTitle="You are the only person with a login so far"
          emptyHint="Instead of sharing your password, select “Add a staff login” and give each teammate their own."
        />
      </SettingsSection>
      <SettingsSection title="What each kind of login can do" description="When you add a staff login, you choose one of these. You can change it later.">
        <dl className="divide-y rounded-lg border">
          <div className="flex gap-4 px-4 py-3 text-sm">
            <dt className="w-32 shrink-0 font-medium">Owner</dt>
            <dd className="text-muted-foreground">Can see and change everything, including the plan and billing, developer API keys and other staff logins. There is only one owner.</dd>
          </div>
          {ROLES.map((r) => (
            <div key={r.value} className="flex gap-4 px-4 py-3 text-sm">
              <dt className="w-32 shrink-0 font-medium">{r.label}</dt>
              <dd className="text-muted-foreground">{r.hint}</dd>
            </div>
          ))}
        </dl>
      </SettingsSection>

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Add a staff login"
        description="This person will sign in to the dashboard with the email and temporary password you set here. Send them the password privately, for example by phone or a secure message, never in a public place."
        onSubmit={() => create.mutate()}
        pending={create.isPending}
        submitLabel="Create this staff login"
      >
        {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <Field label="Their full name" htmlFor="staff-name" required>
          <Input id="staff-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </Field>
        <Field label="Their email address (used to sign in)" htmlFor="staff-email" required>
          <Input id="staff-email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
        </Field>
        <Field label="Temporary password" htmlFor="staff-pass" required hint="Use at least 8 characters. Ask them to change it after their first sign in.">
          <Input
            id="staff-pass"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          />
        </Field>
        <Field label="What should this person be allowed to do?">
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
    meta: { success: "Your developer API key was created. Copy it now, because it will not be shown again." },
    mutationFn: () => api<{ apiKey: string }>("/tenant/api-key", { body: {} }),
    onSuccess: (result) => {
      setNewKey(result.apiKey);
      void queryClient.invalidateQueries({ queryKey: ["api-key"] });
    },
  });

  const revokeApiKey = useMutation({
    meta: { success: "Your developer API key was revoked and no longer works." },
    mutationFn: () => api("/tenant/api-key", { method: "DELETE" }),
    onSuccess: () => {
      setNewKey(null);
      void queryClient.invalidateQueries({ queryKey: ["api-key"] });
    },
  });

  return (
    <>
      <SettingsSection
        title="Website content key"
        description={
          <>
            A secret password that lets your website load your trips, blog posts and pages from this dashboard. Your developer adds it to every request in a header named{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">x-api-key</code>. It is included with every paid plan, but not during the free trial.
          </>
        }
      >
        {newKey ? (
          <div className="space-y-3 rounded-lg border border-amber-300/60 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
              Copy this key now and store it somewhere safe. For your security, it will never be shown again after you leave this page.
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
              <p className="text-sm font-medium">Website content key</p>
              <p className="text-xs text-muted-foreground">
                {isLoading ? "Checking whether a key exists…" : apiKeyStatus?.configured ? "Active and working" : "No key created yet"}
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
                      title: "Replace your API key with a new one?",
                      description: "A new key is created and the current one stops working immediately. Your website will not load content until you give your developer the new key.",
                      confirmLabel: "Yes, replace the key",
                      cancelLabel: "No, keep the current key",
                    },
                    () => createApiKey.mutate(),
                  )
                }
              >
                Replace with a new key
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={revokeApiKey.isPending}
                onClick={() =>
                  confirmDialog(
                    {
                      title: "Revoke your API key?",
                      description: "Your website will stop loading trips, posts and pages from this workspace until you create and install a new key.",
                      confirmLabel: "Yes, revoke the key",
                      cancelLabel: "No, keep the key",
                    },
                    () => revokeApiKey.mutate(),
                  )
                }
              >
                Revoke this key
              </Button>
            </div>
          ) : (
            <Button size="sm" onClick={() => createApiKey.mutate()} disabled={createApiKey.isPending || isLoading || inTrial}>
              {createApiKey.isPending && <Loader2 className="animate-spin" />}
              Create my API key
            </Button>
          )}
        </div>
        {inTrial && (
          <InfoCard
            title="You need a paid plan to create an API key"
            info="Your free trial lets you use this dashboard, but not connect your own website. Choose a plan under “Plan and billing” to unlock API keys."
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
  const planName = access ? PLAN_NAMES[access.plan] : "No plan selected";

  let summary = "";
  if (access?.managed) {
    summary = access.endsAt
      ? `Your plan was arranged directly with the Wepilo team and runs until ${formatDate(access.endsAt)}.`
      : "Your plan was arranged directly with the Wepilo team and has no end date.";
  } else if (access && sub) {
    if (access.state === "TRIAL") {
      summary = `Your free trial ends on ${access.endsAt ? formatDate(access.endsAt) : "a date soon"}. You will not be charged automatically. Choose a plan below before then to keep access.`;
    } else if (access.state === "PAST_DUE") {
      summary = "Your last payment did not go through. Select “Manage payment method and invoices” to update your card, or your plan may be cancelled.";
    } else if (sub.cancelAtPeriodEnd && sub.currentPeriodEnd) {
      summary = `You cancelled this plan. You keep full access until ${formatDate(sub.currentPeriodEnd)}, after which your account locks.`;
    } else if (sub.currentPeriodEnd) {
      summary = `You are billed ${sub.interval === "annual" ? "once a year" : "every month"}. Your next payment is on ${formatDate(sub.currentPeriodEnd)}.`;
    }
  }

  return (
    <>
      <SettingsSection title="Your current plan" description="Your plan decides how many trips, staff logins and files you can have.">
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
                Manage payment method and invoices
              </Button>
            )}
          </div>
        )}
      </SettingsSection>

      {access?.managed ? (
        <SettingsSection title="How to change your plan" description="Your plan was set up directly with the Wepilo team, so it cannot be changed here.">
          <p className="text-sm text-muted-foreground">
            To change your plan, limits or end date,{" "}
            <Link className="font-medium text-foreground underline underline-offset-4" to="/support">
              send us a message on the “Contact Wepilo support” page
            </Link>
            .
          </p>
        </SettingsSection>
      ) : (
      <SettingsSection
        title={sub?.hasPaidSubscription ? "Switch to a different plan" : "Choose a plan"}
        description={
          sub?.hasPaidSubscription
            ? "If you switch plans, you are charged or credited only the difference for the rest of the current billing period, starting today."
            : "After you choose a plan, a secure payment page from Dodo Payments opens, where you enter your card details. Plans renew automatically until you cancel."
        }
      >
        {data && (
          <PlanPicker
            billing={data}
            mode="subscribe"
            canManage={canManage}
            onChanged={() => {
              toast.success("Your plan change was requested. It will appear on this page in a few seconds.");
              setTimeout(() => {
                refetch();
                queryClient.invalidateQueries({ queryKey: ["session"] });
              }, 2500);
            }}
          />
        )}
        <p className="text-sm text-muted-foreground">
          Need more than 25 staff logins or special terms? <Link className="font-medium text-foreground underline underline-offset-4" to="/support">Contact us about an Enterprise plan</Link>.
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

  const current = TABS.find((t) => t.value === active) ?? TABS[0];

  return (
    <div>
      <PageHeader title={current.title} description={current.description} />
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
