import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "@/components/icons";
import { api, toastApiError } from "@/lib/api";
import { Field } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { SettingsSection } from "@/pages/settings/parts";
import { Combobox } from "@/components/combobox";

type PaymentSettings = {
  currency: string;
  currencyTranslation: boolean;
  stripe: { connected: boolean; enabled: boolean; verifiedAt: string | null; accountName: string | null; live: boolean; keyHint: string | null; hasWebhook: boolean };
  bankEnabled: boolean;
  bankInstructions: string;
  depositPercent: number | null;
  autoConfirm: boolean;
  lastError: string | null;
};

/** Popular currencies first, then every other ISO code, each with its name so people can search "dollar" or "yen". */
const POPULAR = ["USD", "EUR", "GBP", "AUD", "CAD", "NZD", "CHF", "INR", "NPR", "JPY", "SGD", "AED", "THB", "ZAR"];
function currencyOptions(current: string) {
  let all: string[] = POPULAR;
  try {
    all = Intl.supportedValuesOf("currency");
  } catch {
    // older browsers: the popular list is enough
  }
  const names = new Intl.DisplayNames(["en"], { type: "currency" });
  const codes = [...new Set([current, ...POPULAR, ...all])].filter(Boolean);
  const label = (code: string) => {
    let name = "";
    try {
      name = names.of(code) ?? "";
    } catch {
      // unknown code: show it bare
    }
    return name && name !== code ? `${code} · ${name}` : code;
  };
  return codes.map((code) => ({ value: code, label: label(code) }));
}

export function PaymentsTab() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["payment-settings"], queryFn: () => api<PaymentSettings>("/payments/settings") });
  const [form, setForm] = useState({ currency: "USD", currencyTranslation: false, bankEnabled: false, bankInstructions: "", deposit: "", autoConfirm: false });
  const [secretKey, setSecretKey] = useState("");

  useEffect(() => {
    if (data) {
      setForm({
        currency: data.currency,
        currencyTranslation: data.currencyTranslation,
        bankEnabled: data.bankEnabled,
        bankInstructions: data.bankInstructions,
        deposit: data.depositPercent ? String(data.depositPercent) : "",
        autoConfirm: data.autoConfirm,
      });
    }
  }, [data]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const apply = (next: PaymentSettings) => queryClient.setQueryData(["payment-settings"], next);

  const save = useMutation({
    meta: { success: "Payment settings saved." },
    mutationFn: () =>
      api<PaymentSettings>("/payments/settings", {
        method: "PUT",
        body: {
          currency: form.currency,
          currencyTranslation: form.currencyTranslation,
          bankEnabled: form.bankEnabled,
          bankInstructions: form.bankInstructions.trim() || null,
          depositPercent: form.deposit ? Number(form.deposit) : null,
          autoConfirm: form.autoConfirm,
        },
      }),
    onSuccess: (next) => {
      apply(next);
      void queryClient.invalidateQueries({ queryKey: ["session"] });
    },
    onError: (err) => toastApiError(err),
  });

  const connect = useMutation({
    meta: { success: "Stripe connected. Card payments are on." },
    mutationFn: () => api<PaymentSettings>("/payments/settings/stripe", { body: { secretKey: secretKey.trim() } }),
    onSuccess: (next) => {
      setSecretKey("");
      apply(next);
    },
    onError: (err) => toastApiError(err),
  });
  const toggleStripe = useMutation({
    mutationFn: (enabled: boolean) => api<PaymentSettings>("/payments/settings", { method: "PUT", body: { stripeEnabled: enabled } }),
    onSuccess: apply,
    onError: (err) => toastApiError(err),
  });
  const disconnect = useMutation({
    meta: { success: "Stripe disconnected." },
    mutationFn: () => api<PaymentSettings>("/payments/settings/stripe", { method: "DELETE" }),
    onSuccess: apply,
  });

  if (isLoading || !data) return <Skeleton className="h-64 w-full" />;
  const dirty =
    form.currency !== data.currency ||
    form.currencyTranslation !== data.currencyTranslation ||
    form.bankEnabled !== data.bankEnabled ||
    form.bankInstructions !== data.bankInstructions ||
    form.deposit !== (data.depositPercent ? String(data.depositPercent) : "") ||
    form.autoConfirm !== data.autoConfirm;

  return (
    <>
      <SettingsSection
        title="Card payments"
        description="Travellers pay on Stripe's secure page and the money goes straight to your Stripe account. Wepilo never holds it."
      >
        {data.stripe.connected ? (
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-sm font-medium">
                  {data.stripe.accountName ?? "Stripe account"}
                  <Badge variant="secondary" className="font-normal">
                    {data.stripe.live ? "Live" : "Test mode"}
                  </Badge>
                </p>
                <p className="text-xs text-muted-foreground">Key {data.stripe.keyHint}</p>
              </div>
              <Switch checked={data.stripe.enabled} disabled={toggleStripe.isPending} onCheckedChange={(v) => toggleStripe.mutate(v)} aria-label="Accept card payments" />
            </div>
            {!data.stripe.live ? <p className="text-xs text-foreground">Test mode: no real money moves. Connect a live key when you are ready.</p> : null}
            {!data.stripe.hasWebhook ? <p className="text-xs text-muted-foreground">Payments will be picked up within the hour. Use a key that can manage webhooks for instant updates.</p> : null}
            <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={disconnect.isPending} onClick={() => disconnect.mutate()}>
              Disconnect Stripe
            </Button>
          </div>
        ) : null}
        <Field
          label={data.stripe.connected ? "Replace Stripe key" : "Stripe secret key"}
          hint="In Stripe go to Developers → API keys and copy a secret (sk_…) or restricted (rk_…) key. It is checked, then stored encrypted."
        >
          <div className="flex gap-2">
            <Input type="password" autoComplete="off" value={secretKey} onChange={(e) => setSecretKey(e.target.value)} placeholder="sk_live_…" />
            <Button type="button" disabled={connect.isPending || !secretKey.trim()} onClick={() => connect.mutate()}>
              {connect.isPending && <Loader2 className="animate-spin" />}
              Connect
            </Button>
          </div>
        </Field>
        {data.lastError ? <p className="text-sm text-destructive">{data.lastError}</p> : null}
      </SettingsSection>

      <SettingsSection title="Bank transfer" description="Travellers get your bank details and a reference. You mark the payment received once the money arrives.">
        <label className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm">
          Offer bank transfer
          <Switch checked={form.bankEnabled} onCheckedChange={(v) => set("bankEnabled", v)} />
        </label>
        <Field label="Instructions shown to travellers" hint="Account name, IBAN or account number, bank and SWIFT code.">
          <Textarea rows={4} value={form.bankInstructions} onChange={(e) => set("bankInstructions", e.target.value)} />
        </Field>
      </SettingsSection>

      <SettingsSection title="Pricing and deposits" description="Every price in your account (departures, extras) is in one currency.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Currency" hint="Existing prices are not converted. Update them if you change this.">
            <Combobox
              value={form.currency}
              setValue={(v) => set("currency", v)}
              placeholder="Search for a currency"
              notFoundPlaceholder="No currency found."
              options={currencyOptions(form.currency)}
            />
          </Field>
          <Field label="Deposit (%)" hint="Share paid up front. Leave empty to ask for the full amount.">
            <Input type="number" min={1} max={99} value={form.deposit} onChange={(e) => set("deposit", e.target.value)} placeholder="Full payment" />
          </Field>
        </div>
        <label className="flex items-start justify-between gap-4 rounded-lg border px-4 py-3 text-sm">
          <span>
            <span className="block font-medium">Show prices in the visitor's currency</span>
            <span className="text-xs text-muted-foreground">
              Your website can convert prices from {form.currency} to the currency each visitor uses, with daily exchange rates. It is only a guide for browsing: travellers are still charged in {form.currency}, and you keep entering every price in {form.currency}.
            </span>
          </span>
          <Switch checked={form.currencyTranslation} onCheckedChange={(v) => set("currencyTranslation", v)} />
        </label>
        <label className="flex items-start justify-between gap-4 rounded-lg border px-4 py-3 text-sm">
          <span>
            <span className="block font-medium">Confirm bookings automatically when paid</span>
            <span className="text-xs text-muted-foreground">Takes the seats as soon as a card payment lands. If the trip sold out meanwhile, the payment is held for you to review.</span>
          </span>
          <Switch checked={form.autoConfirm} onCheckedChange={(v) => set("autoConfirm", v)} />
        </label>
        <Button type="button" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
          {save.isPending && <Loader2 className="animate-spin" />}
          Save
        </Button>
      </SettingsSection>
    </>
  );
}
