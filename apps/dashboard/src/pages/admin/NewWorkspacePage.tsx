import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { api, ApiClientError } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Field } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PLAN_NAMES, type PlanKey } from "@/pages/billing/billing";
import { fromDateInput, toDateInput, type SetupLink, type WorkspaceSummary } from "./admin-api";
import { SetupLinkPanel } from "./handover";

const slugFrom = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

const inOneYear = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return toDateInput(d.toISOString());
};

export function NewWorkspacePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    companyName: "",
    slug: "",
    ownerName: "",
    ownerEmail: "",
    phone: "",
    website: "",
    plan: "ENTERPRISE" as PlanKey,
    endDate: inOneYear(),
    noEndDate: false,
    internalNotes: "",
    sendSetupEmail: true,
  });
  const [slugEdited, setSlugEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ tenant: WorkspaceSummary; setup: SetupLink } | null>(null);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));
  const openEnded = form.plan === "ENTERPRISE" && form.noEndDate;

  const create = useMutation({
    mutationFn: () =>
      api<{ tenant: WorkspaceSummary; setup: SetupLink }>("/platform/tenants", {
        body: {
          companyName: form.companyName,
          slug: form.slug,
          ownerName: form.ownerName,
          ownerEmail: form.ownerEmail,
          phone: form.phone || undefined,
          website: form.website || undefined,
          plan: form.plan,
          planExpiresAt: openEnded ? null : fromDateInput(form.endDate),
          internalNotes: form.internalNotes || undefined,
          sendSetupEmail: form.sendSetupEmail,
        },
      }),
    onSuccess: (result) => {
      setCreated(result);
      queryClient.invalidateQueries({ queryKey: ["platform"] });
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : "Something went wrong"),
  });

  const back = (
    <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2 text-muted-foreground">
      <Link to="/admin/workspaces">
        <ArrowLeft />
        Workspaces
      </Link>
    </Button>
  );

  if (created) {
    return (
      <div className="max-w-2xl">
        {back}
        <PageHeader
          title={`${created.tenant.companyName} is ready`}
          description="The workspace is live on the plan you chose. The client takes over by setting a password through the link below."
        />
        <SetupLinkPanel link={created.setup} ownerEmail={created.tenant.email} />
        <div className="mt-6 flex flex-wrap gap-2">
          <Button onClick={() => navigate(`/admin/workspaces/${created.tenant.id}`)}>Open workspace details</Button>
          <Button variant="outline" asChild>
            <Link to="/admin/workspaces">Back to all workspaces</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      {back}
      <PageHeader
        title="New workspace"
        description="Set up an agency on a plan you've agreed with them, then hand it over with a one-time setup link."
      />
      <form
        className="space-y-8"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          create.mutate();
        }}
      >
        <Section title="Agency">
          <Field label="Company name" htmlFor="companyName" required>
            <Input
              id="companyName"
              required
              value={form.companyName}
              onChange={(e) => {
                set("companyName", e.target.value);
                if (!slugEdited) set("slug", slugFrom(e.target.value));
              }}
            />
          </Field>
          <Field label="Slug" htmlFor="slug" required hint="Used by the website API (x-tenant-slug). Lowercase letters, numbers and dashes.">
            <Input
              id="slug"
              required
              pattern="[a-z0-9-]{2,60}"
              value={form.slug}
              onChange={(e) => {
                setSlugEdited(true);
                set("slug", e.target.value.toLowerCase());
              }}
              className="font-mono"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone" htmlFor="phone">
              <Input id="phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </Field>
            <Field label="Website" htmlFor="website">
              <Input id="website" type="url" placeholder="https://" value={form.website} onChange={(e) => set("website", e.target.value)} />
            </Field>
          </div>
        </Section>

        <Section title="Owner" description="The client's main login. They can add their own staff after taking over.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="ownerName" required>
              <Input id="ownerName" required value={form.ownerName} onChange={(e) => set("ownerName", e.target.value)} />
            </Field>
            <Field label="Email" htmlFor="ownerEmail" required>
              <Input id="ownerEmail" type="email" required value={form.ownerEmail} onChange={(e) => set("ownerEmail", e.target.value)} />
            </Field>
          </div>
        </Section>

        <Section title="Plan" description="Billed outside Wepilo's checkout. The workspace and website API stay on until the end date.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Plan" required>
              <Select value={form.plan} onValueChange={(v) => set("plan", v as PlanKey)}>
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
            <Field label="Access until" htmlFor="endDate" required={!openEnded}>
              <Input
                id="endDate"
                type="date"
                required={!openEnded}
                disabled={openEnded}
                min={toDateInput(new Date().toISOString())}
                value={openEnded ? "" : form.endDate}
                onChange={(e) => set("endDate", e.target.value)}
              />
            </Field>
          </div>
          {form.plan === "ENTERPRISE" && (
            <label className="flex items-center gap-3 text-sm">
              <Switch checked={form.noEndDate} onCheckedChange={(v) => set("noEndDate", v)} />
              No end date (runs until you change it)
            </label>
          )}
          <Field label="Internal notes" htmlFor="notes" hint="Deal terms, contacts, invoice reference. Only Wepilo admins see this.">
            <Textarea id="notes" rows={3} value={form.internalNotes} onChange={(e) => set("internalNotes", e.target.value)} />
          </Field>
        </Section>

        <Section title="Handover">
          <label className="flex items-start gap-3 text-sm">
            <Switch className="mt-0.5" checked={form.sendSetupEmail} onCheckedChange={(v) => set("sendSetupEmail", v)} />
            <span>
              Email the setup link to the owner now
              <span className="block text-muted-foreground">
                Turn off to prepare the workspace first. You'll get the link to send yourself, and can issue a new one any time.
              </span>
            </span>
          </label>
        </Section>

        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2 border-t pt-6">
          <Button type="submit" disabled={create.isPending}>
            {create.isPending && <Loader2 className="animate-spin" />}
            Create workspace
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link to="/admin/workspaces">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}
