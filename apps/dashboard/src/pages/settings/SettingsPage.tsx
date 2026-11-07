import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound, Loader2, PenLine, Power, Trash2, UserPlus, Users2 } from "@/components/icons";
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
import { SettingsSection } from "@/pages/settings/parts";
import { EmailTab } from "@/pages/settings/EmailTab";
import { PaymentsTab } from "@/pages/settings/PaymentsTab";
import { DomainTab } from "@/pages/settings/DomainTab";
import { DataTable, RowActions, type Column } from "@/components/data-table";
import { confirmDialog } from "@/components/confirm";
import { useErrorMessage } from "@/pages/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CopyIcon } from "@/components/ui/morphing-icons";
import { Thumb } from "@/components/thumb";

type StaffMember = {
  id: number;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  /** Public byline profile, shown with the posts this person writes. */
  username?: string | null;
  bio?: string | null;
  image?: string | null;
};

const TABS = [
  { value: "profile", label: "Business profile" },
  { value: "staff", label: "Staff logins" },
  { value: "api-keys", label: "API keys" },
  { value: "payments", label: "Payments" },
  { value: "email", label: "Email" },
  { value: "website", label: "Domain" },
  { value: "billing", label: "Billing" },
] as const;

/** Tabs whose API calls need an owner or admin. */
const ADMIN_ONLY_TABS: string[] = ["email", "payments", "website"];

const ROLES = [
  { value: "ADMIN", label: "Admin", hint: "Can see and change everything except the plan and billing, and the developer API keys." },
  { value: "MANAGER", label: "Manager", hint: "Can manage trips, departure dates, customer bookings and inquiries, and all website content." },
  { value: "EDITOR", label: "Editor", hint: "Can only write and edit blog posts, website pages and the media library. Cannot see customer bookings or business settings." },
  { value: "AUTHOR", label: "Author", hint: "Can only write blog posts and use the media library. Their name, photo and short bio appear on the posts they write. Cannot edit website pages or see anything else." },
];

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

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
          () => toast.error("The text could not be copied automatically. Select it with your mouse and copy it yourself."),
        )
      }
    >
      <CopyIcon copied={copied} size={16} />
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
      <SettingsSection title="Brand" description="Your name and logo appear on your public website, in emails to travellers, and in this dashboard.">
        <Field label="Business name" htmlFor="companyName" required hint="Use the name travellers know you by.">
          <Input id="companyName" value={form.companyName} onChange={(e) => set("companyName", e.target.value)} />
        </Field>
        <Field label="Logo" hint="Use a square or wide PNG or SVG picture with a transparent background for the best result.">
          <ImageField shape="square" label="Upload logo" value={form.companyLogo} onChange={(url) => set("companyLogo", url)} />
        </Field>
        <Field label="About your business" htmlFor="desc" hint="Write a short paragraph about who you are and what you offer. It is shown in your website footer and “About” section.">
          <Textarea id="desc" rows={4} value={form.companyDescription} onChange={(e) => set("companyDescription", e.target.value)} />
        </Field>
      </SettingsSection>

      <SettingsSection title="Contact" description="How travellers can reach you. These are shown on your website and in booking emails.">
        <Field label="Website" htmlFor="website" hint="Type the full address, starting with https://. Used for the “View site” button.">
          <Input id="website" type="url" value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://www.example.com" />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Phone" htmlFor="phone" hint="Include the country code.">
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
        <span className="text-sm text-muted-foreground">You have unsaved changes</span>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={() => setForm(JSON.parse(baseline) as ProfileForm)} disabled={save.isPending}>
            Discard
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
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "EDITOR", bio: "", image: "" });
  const [profile, setProfile] = useState<{ member: StaffMember; bio: string; image: string; username: string } | null>(null);
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
    mutationFn: () => api("/tenant/staff", { body: { ...form, bio: form.bio || undefined, image: form.image || undefined } }),
    onSuccess: () => {
      invalidate();
      setDialogOpen(false);
      setForm({ name: "", email: "", password: "", role: "EDITOR", bio: "", image: "" });
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
      header: "Person",
      cell: (m) => (
        <div className="flex items-center gap-3">
          <Thumb round src={m.image} name={m.name} />
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
              <SelectTrigger size="sm" className="w-32" aria-label={`Choose what ${m.name} is allowed to do`}>
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
                label: "Edit public profile",
                icon: PenLine,
                onSelect: () => setProfile({ member: m, bio: m.bio ?? "", image: m.image ?? "", username: m.username ?? "" }),
              },
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
                    { title: `Remove the login for ${m.name}?`, description: `${m.name} will no longer be able to sign in to this dashboard. Nothing they created is deleted. If you only want to pause their access for now, choose “Disable login” instead.`, confirmLabel: "Yes, remove this login" },
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
          emptyHint="Instead of sharing your password, select “Add staff login” and give each teammate their own."
        />
      </SettingsSection>
      <SettingsSection title="Roles" description="When you add a staff login, you choose one of these. You can change it later.">
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
        description="This person will sign in to the dashboard with the email and temporary password you set here. Send them the password privately, for example by phone or a secure message, never in a public place."
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
        <Field label="Temporary password" name="password" htmlFor="staff-pass" required hint="Use at least 8 characters. Ask them to change it after their first sign in.">
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
        <Field label="Short bio" name="bio" hint="Optional. Shown under their name on the posts they write.">
          <Textarea rows={3} value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} />
        </Field>
        <Field label="Photo" hint="Optional.">
          <ImageField value={form.image} onChange={(url) => setForm((f) => ({ ...f, image: url }))} />
        </Field>
      </FormDialog>

      <FormDialog
        open={Boolean(profile)}
        onOpenChange={(o) => !o && setProfile(null)}
        title={profile ? `Public profile for ${profile.member.name}` : "Public profile"}
        description="This is what readers see next to the posts this person writes."
        onSubmit={() =>
          profile &&
          update.mutate(
            { id: profile.member.id, body: { bio: profile.bio || null, image: profile.image || null, ...(profile.username ? { username: profile.username } : {}) } },
            { onSuccess: () => setProfile(null) },
          )
        }
        pending={update.isPending}
      >
        {profile && (
          <>
            <Field label="Username" hint="Used in the address of their author page on your website.">
              <Input value={profile.username} onChange={(e) => setProfile((p) => p && { ...p, username: e.target.value })} />
            </Field>
            <Field label="Short bio">
              <Textarea rows={4} value={profile.bio} onChange={(e) => setProfile((p) => p && { ...p, bio: e.target.value })} />
            </Field>
            <Field label="Photo">
              <ImageField value={profile.image} onChange={(url) => setProfile((p) => p && { ...p, image: url })} />
            </Field>
          </>
        )}
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
        title="Content API key"
        description={
          <>
            A secret password that lets your website load your trips, blog posts and pages from this dashboard. Your developer adds it to every request in a header named{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">x-api-key</code>. It is included with every paid plan, but not during the free trial.
          </>
        }
      >
        {newKey ? (
          <div className="space-y-3 rounded-lg border border-border bg-muted p-4">
            <p className="text-sm font-medium text-foreground">
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
                      description: "A new key is created and the current one stops working immediately. Your website will not load content until you give your developer the new key.",
                      confirmLabel: "Yes, replace the key",
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
                      description: "Your website will stop loading trips, posts and pages from this workspace until you create and install a new key.",
                      confirmLabel: "Yes, revoke the key",
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
            info="Your free trial lets you use this dashboard, but not connect your own website. Choose a plan under “Billing” to unlock API keys."
          />
        )}
      </SettingsSection>

      <ConnectedAppsSection />
    </>
  );
}

// ── Connected AI apps ───────────────────────────────────────────────────────

type ConnectedApp = { id: string; clientName: string; createdAt: number };

function ConnectedAppsSection() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["connected-apps"],
    queryFn: () => api<{ data: ConnectedApp[]; mcpUrl: string }>("/connect/grants"),
  });

  const revoke = useMutation({
    meta: { success: "Disconnected. That app can no longer use your workspace." },
    mutationFn: (id: string) => api(`/connect/grants/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["connected-apps"] }),
  });

  return (
    <SettingsSection
      title="Connected AI apps"
      description={
        <>
          Connect Claude, ChatGPT or other AI apps to see what needs you today, handle inquiries and bookings, add departures and draft
          trips by chat. Website builders like Lovable and Base44 can use the same connection to wire your website to Wepilo. Each person
          connects with their own login and keeps their role&apos;s permissions.
        </>
      }
    >
      <div className="space-y-2">
        <p className="text-sm font-medium">Connector URL</p>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-xl border bg-muted/40 px-3 py-2.5 font-mono text-xs">
            {data?.mcpUrl ?? "Loading…"}
          </code>
          {data?.mcpUrl && <CopyButton value={data.mcpUrl} />}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          In Claude: Settings → Connectors → Add custom connector. In ChatGPT: Settings → Connectors (developer mode). In Lovable:
          Connectors → Add custom → MCP server. In Base44: Settings → MCP connections → Add custom MCP. Paste this URL, then sign in to
          Wepilo and choose Allow.
        </p>
      </div>

      <div className="rounded-2xl border">
        {isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-5 w-1/3" />
          </div>
        ) : data?.data.length ? (
          <ul className="divide-y">
            {data.data.map((app) => (
              <li key={app.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {app.clientName.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{app.clientName}</p>
                  <p className="text-xs text-muted-foreground">Connected {formatDate(new Date(app.createdAt).toISOString())}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  disabled={revoke.isPending}
                  onClick={() =>
                    confirmDialog(
                      {
                        title: `Disconnect ${app.clientName}?`,
                        description: "It will lose access to your workspace straight away. You can connect it again later.",
                        confirmLabel: "Disconnect",
                      },
                      () => revoke.mutate(app.id),
                    )
                  }
                >
                  Disconnect
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-5 text-sm text-muted-foreground">No AI apps are connected with your login yet.</p>
        )}
      </div>
    </SettingsSection>
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
      ? `Your plan was arranged directly with the Wepilo team and runs until ${formatDate(access.endsAt)}.`
      : "Arranged with the Wepilo team · no end date";
  } else if (access && sub) {
    if (access.state === "TRIAL") {
      summary = `Your free trial ends on ${access.endsAt ? formatDate(access.endsAt) : "a date soon"}. You will not be charged automatically. Choose a plan below before then to keep access.`;
    } else if (access.state === "PAST_DUE") {
      summary = "Your last payment did not go through. Select “Manage billing” to update your card, or your plan may be cancelled.";
    } else if (sub.cancelAtPeriodEnd && sub.currentPeriodEnd) {
      summary = `You cancelled this plan. You keep full access until ${formatDate(sub.currentPeriodEnd)}, after which your account locks.`;
    } else if (sub.currentPeriodEnd) {
      summary = `You are billed ${sub.interval === "annual" ? "once a year" : "every month"}. Your next payment is on ${formatDate(sub.currentPeriodEnd)}.`;
    }
  }

  return (
    <>
      <SettingsSection title="Current plan" description="Your plan decides how many trips, staff logins and files you can have.">
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
        <SettingsSection title="Changing your plan" description="Your plan was set up directly with the Wepilo team, so it cannot be changed here.">
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
  const { data: session } = useSession();
  const canConfigure = session?.staff.role === "OWNER" || session?.staff.role === "ADMIN";
  const tabs = TABS.filter((t) => canConfigure || !ADMIN_ONLY_TABS.includes(t.value));
  const active = tabs.some((t) => t.value === segments[1]) ? segments[1] : "profile";


  return (
    <div>
      <PageHeader title="Settings" description="Your business details, who can sign in, website access and your plan. Pick a tab to change one of them." />
      <Tabs value={active} onValueChange={(value) => navigate(value === "profile" ? "/settings" : `/settings/${value}`)}>
        <TabsList variant="line" className="w-full justify-start border-b">
          {tabs.map((tab) => (
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
        <TabsContent value="payments" className="pt-4">
          <PaymentsTab />
        </TabsContent>
        <TabsContent value="website" className="pt-4">
          <DomainTab />
        </TabsContent>
        <TabsContent value="email" className="pt-4">
          <EmailTab />
        </TabsContent>
        <TabsContent value="billing" className="pt-4">
          <BillingTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
