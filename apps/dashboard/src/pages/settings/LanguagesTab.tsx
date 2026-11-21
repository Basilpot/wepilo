import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, X } from "@/components/icons";
import { api } from "@/lib/api";
import { Field } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Combobox } from "@/components/combobox";
import { SettingsSection } from "@/pages/settings/parts";
import { useWorkspaceLanguages } from "@/components/language-switch";
import { languageName } from "@/lib/translations";

type Languages = { defaultLanguage: string; languages: string[] };

/** Languages travel agencies publish in most, first; the rest follow in alphabetical order. */
const POPULAR = ["en", "de", "fr", "es", "it", "nl", "pt", "pt-BR", "ja", "zh", "zh-Hant", "ko", "ru", "pl", "sv", "da", "no", "fi", "he", "ar", "hi", "ne", "th", "id", "tr", "cs"];
const OTHERS = ["af", "bg", "bn", "ca", "el", "et", "fa", "hr", "hu", "is", "lt", "lv", "ms", "ro", "sk", "sl", "sr", "sw", "ta", "tl", "uk", "ur", "vi"];

function options(exclude: string[]) {
  const codes = [...POPULAR, ...OTHERS.sort((a, b) => languageName(a).localeCompare(languageName(b)))];
  return codes.filter((c) => !exclude.includes(c)).map((c) => ({ value: c, label: `${languageName(c)} · ${c}` }));
}

/**
 * The language you write in, and the other languages your website is published in. Each trip,
 * page and post then gets a language switch in its editor. Your website shows each language at
 * its own address, like /de/…, with untranslated text falling back to the original.
 */
export function LanguagesTab() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useWorkspaceLanguages();
  const [form, setForm] = useState<Languages>({ defaultLanguage: "en", languages: [] });
  const [adding, setAdding] = useState("");

  useEffect(() => {
    if (data) setForm({ defaultLanguage: data.defaultLanguage, languages: data.languages });
  }, [data]);

  const save = useMutation({
    meta: { success: "Languages saved." },
    mutationFn: () => api<Languages>("/tenant/languages", { method: "PUT", body: form }),
    onSuccess: (next) => queryClient.setQueryData(["languages"], next),
  });

  const addOptions = useMemo(() => options([form.defaultLanguage, ...form.languages]), [form]);
  if (isLoading || !data) return <Skeleton className="h-64 w-full" />;
  const dirty = JSON.stringify(form) !== JSON.stringify({ defaultLanguage: data.defaultLanguage, languages: data.languages });

  return (
    <div className="space-y-8">
      <SettingsSection
        title="Languages"
        description="The language you write in, and every other language your website is published in. Trips, pages and posts then get a language switch in their editor."
      >
        <Field label="You write in" hint="Your trips, pages and posts are written in this language first. Changing it doesn't translate anything.">
          <Combobox
            value={form.defaultLanguage}
            setValue={(v) => v && setForm((f) => ({ defaultLanguage: v, languages: f.languages.filter((l) => l !== v) }))}
            placeholder="Search for a language"
            notFoundPlaceholder="No language found."
            options={options([]).map((o) => o)}
          />
        </Field>

        <Field label="Also published in" hint="Add a language, then translate each trip, page and post from its editor. Anything not translated yet shows in the original.">
          <div className="space-y-3">
            {form.languages.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {form.languages.map((code) => (
                  <li key={code} className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 py-1 pr-1 pl-3 text-sm">
                    {languageName(code)}
                    <span className="font-mono text-xs text-muted-foreground">/{code}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${languageName(code)}`}
                      onClick={() => setForm((f) => ({ ...f, languages: f.languages.filter((l) => l !== code) }))}
                      className="inline-flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <X className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Combobox
              value={adding}
              setValue={(v) => {
                if (v) setForm((f) => ({ ...f, languages: [...f.languages, v] }));
                setAdding("");
              }}
              placeholder="Add a language"
              notFoundPlaceholder="No language found."
              options={addOptions}
            />
          </div>
        </Field>

        <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          Your website shows each language at its own address: <span className="font-mono text-foreground">/trips/…</span> in {languageName(form.defaultLanguage)},{" "}
          {form.languages[0] ? (
            <>
              <span className="font-mono text-foreground">/{form.languages[0]}/trips/…</span> in {languageName(form.languages[0])}
            </>
          ) : (
            "and /de/trips/… for German once you add it"
          )}
          . Removing a language hides it from your website but keeps its translations, so adding it back restores them.
        </div>

        <Button type="button" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
          {save.isPending && <Loader2 className="animate-spin" />}
          Save
        </Button>
      </SettingsSection>
    </div>
  );
}
