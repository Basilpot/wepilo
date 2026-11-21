import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "@/components/icons";
import { api } from "@/lib/api";
import { Field } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { SettingsSection } from "@/pages/settings/parts";
import { Combobox } from "@/components/combobox";

type CurrencySettings = { currency: string; currencyTranslation: boolean };

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

export function CurrencyTab() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["currency-settings"], queryFn: () => api<CurrencySettings>("/currency-settings") });
  const [form, setForm] = useState<CurrencySettings>({ currency: "USD", currencyTranslation: false });

  useEffect(() => {
    if (data) setForm({ currency: data.currency, currencyTranslation: data.currencyTranslation });
  }, [data]);

  const save = useMutation({
    meta: { success: "Currency saved." },
    mutationFn: () => api<CurrencySettings>("/currency-settings", { method: "PUT", body: form }),
    onSuccess: (next) => {
      queryClient.setQueryData(["currency-settings"], next);
      void queryClient.invalidateQueries({ queryKey: ["session"] });
    },
  });

  if (isLoading || !data) return <Skeleton className="h-64 w-full" />;
  const dirty = form.currency !== data.currency || form.currencyTranslation !== data.currencyTranslation;

  return (
    <SettingsSection
      title="Currency"
      description="Every price in your account (departures, extras) is in one currency. Wepilo doesn't take bookings or payments: you agree dates and collect payment with your travellers."
    >
      <Field label="Currency" hint="Existing prices are not converted. Update them if you change this.">
        <Combobox
          value={form.currency}
          setValue={(v) => setForm((f) => ({ ...f, currency: v }))}
          placeholder="Search for a currency"
          notFoundPlaceholder="No currency found."
          options={currencyOptions(form.currency)}
        />
      </Field>
      <label className="flex items-start justify-between gap-4 rounded-lg border px-4 py-3 text-sm">
        <span>
          <span className="block font-medium">Show prices in the visitor's currency</span>
          <span className="text-xs text-muted-foreground">
            Your website can convert prices from {form.currency} to the currency each visitor uses, with daily exchange rates. It is only a guide for browsing: you keep entering every price in {form.currency}.
          </span>
        </span>
        <Switch checked={form.currencyTranslation} onCheckedChange={(v) => setForm((f) => ({ ...f, currencyTranslation: v }))} />
      </label>
      <Button type="button" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
        {save.isPending && <Loader2 className="animate-spin" />}
        Save
      </Button>
    </SettingsSection>
  );
}
