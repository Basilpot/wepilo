import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "@/components/icons";
import { api, toastApiError } from "@/lib/api";
import { Field } from "@/components/form";
import { StringArrayInput } from "@/components/string-array-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { SettingsSection } from "@/pages/settings/parts";

type EmailSettings = {
  config: {
    fromEmail: string | null;
    fromName: string | null;
    replyTo: string | null;
    inquiryRecipients: string[];
    enabled: boolean;
    verifiedAt: string | null;
    lastError: string | null;
    hasApiKey: boolean;
    apiKeyHint: string | null;
  } | null;
  ownerEmail: string | null;
};

type Form = {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  replyTo: string;
  recipients: string[];
  enabled: boolean;
};

const toForm = (data: EmailSettings): Form => ({
  apiKey: "",
  fromEmail: data.config?.fromEmail ?? "",
  fromName: data.config?.fromName ?? "",
  replyTo: data.config?.replyTo ?? "",
  recipients: data.config?.inquiryRecipients ?? [],
  enabled: (data.config?.enabled ?? false) && Boolean(data.config?.verifiedAt),
});

export function EmailTab() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["email-settings"], queryFn: () => api<EmailSettings>("/tenant/email-settings") });
  const [form, setForm] = useState<Form | null>(null);
  useEffect(() => {
    if (data) setForm(toForm(data));
  }, [data]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => (f ? { ...f, [key]: value } : f));

  const save = useMutation({
    meta: { success: "Email settings saved." },
    mutationFn: () =>
      api<EmailSettings>("/tenant/email-settings", {
        method: "PUT",
        body: {
          ...(form!.apiKey.trim() ? { apiKey: form!.apiKey.trim() } : {}),
          fromEmail: form!.fromEmail.trim() || null,
          fromName: form!.fromName.trim() || null,
          replyTo: form!.replyTo.trim() || null,
          inquiryRecipients: form!.recipients,
          enabled: form!.enabled,
        },
      }),
    onSuccess: (next) => queryClient.setQueryData(["email-settings"], next),
  });

  const test = useMutation({
    mutationFn: () => api<EmailSettings & { sentTo: string }>("/tenant/email-settings/test", { method: "POST", body: {} }),
    onSuccess: (next) => {
      queryClient.setQueryData(["email-settings"], next);
      toast.success(`Test email sent to ${next.sentTo}. Your own account is now used for all website email.`);
    },
    onError: (err) => {
      void queryClient.invalidateQueries({ queryKey: ["email-settings"] });
      toastApiError(err, "The test email could not be sent.");
    },
  });

  const disconnect = useMutation({
    meta: { success: "Disconnected. Email goes out from Wepilo's address again." },
    mutationFn: () => api("/tenant/email-settings", { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["email-settings"] }),
  });

  if (isLoading || !form || !data) return <Skeleton className="h-64 w-full" />;
  const config = data.config;
  const verified = Boolean(config?.verifiedAt);
  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(data));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <SettingsSection
        title="Who gets alerts"
        description="Booking requests and website inquiries are emailed here. Leave it empty to use your account email."
      >
        <Field label="Send alerts to" hint={`Type an address and press Enter. Empty means ${data.ownerEmail ?? "your account email"}.`}>
          <StringArrayInput value={form.recipients} onChange={(v) => set("recipients", v)} placeholder="sales@youragency.com" />
        </Field>
      </SettingsSection>

      <SettingsSection
        title="Send from your own address"
        description={
          <>
            By default email to travellers (newsletters, alerts) is sent from Wepilo with your address as the reply-to. Connect your own{" "}
            <a className="underline underline-offset-4" href="https://resend.com" target="_blank" rel="noreferrer">
              Resend
            </a>{" "}
            account to send from your own domain instead.
          </>
        }
      >
        <div className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3">
          <div>
            <p className="text-sm font-medium">
              {verified ? "Sending from your own account" : config?.hasApiKey ? "Saved, not verified yet" : "Not connected"}
            </p>
            <p className="text-xs text-muted-foreground">
              {verified
                ? `Verified ${new Date(config!.verifiedAt!).toLocaleDateString()}`
                : "Send a test email to switch it on."}
            </p>
          </div>
          <Switch checked={verified && form.enabled} disabled={!verified} onCheckedChange={(v) => set("enabled", v)} aria-label="Use my own email account" />
        </div>
        {config?.lastError ? <p className="text-sm text-destructive">{config.lastError}</p> : null}
        <Field label="Resend API key" hint={config?.hasApiKey ? `Saved as ${config.apiKeyHint}. Type a new key to replace it.` : "Create one in Resend under API Keys. It is stored encrypted."}>
          <Input
            type="password"
            autoComplete="off"
            value={form.apiKey}
            onChange={(e) => set("apiKey", e.target.value)}
            placeholder={config?.hasApiKey ? "••••••••••" : "re_…"}
          />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="From address" hint="Must be on a domain you verified in Resend.">
            <Input type="email" value={form.fromEmail} onChange={(e) => set("fromEmail", e.target.value)} placeholder="hello@youragency.com" />
          </Field>
          <Field label="From name" hint="Shown to travellers. Defaults to your business name.">
            <Input value={form.fromName} onChange={(e) => set("fromName", e.target.value)} />
          </Field>
        </div>
        <Field label="Reply-to address" hint="Where replies go. Optional.">
          <Input type="email" value={form.replyTo} onChange={(e) => set("replyTo", e.target.value)} />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={save.isPending || !dirty}>
            {save.isPending && <Loader2 className="animate-spin" />}
            Save
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={test.isPending || dirty || !config?.hasApiKey}
            onClick={() => test.mutate()}
            title={dirty ? "Save your changes first" : undefined}
          >
            {test.isPending && <Loader2 className="animate-spin" />}
            Send test email
          </Button>
          {config?.hasApiKey ? (
            <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" disabled={disconnect.isPending} onClick={() => disconnect.mutate()}>
              Disconnect
            </Button>
          ) : null}
        </div>
      </SettingsSection>
    </form>
  );
}
