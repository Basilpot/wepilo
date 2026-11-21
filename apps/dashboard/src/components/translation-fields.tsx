import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronRight } from "@/components/icons";
import { useWorkspaceLanguages } from "@/components/language-switch";
import { languageName, type Translations } from "@/lib/translations";

type FieldDef = { key: string; label: string; multiline?: boolean };

/**
 * Translations for short records (a category, a place, an extra): one row of fields per
 * language, with the original as the placeholder. Empty means "show the original".
 * Hidden when the workspace only publishes in one language.
 */
export function TranslationFields({
  value,
  onChange,
  fields,
  original,
}: {
  value: Translations;
  onChange: (next: Translations) => void;
  fields: FieldDef[];
  original: Record<string, string>;
}) {
  const { data } = useWorkspaceLanguages();
  const langs = data?.languages ?? [];
  if (!langs.length) return null;
  const done = langs.filter((l) => value[l] && Object.values(value[l]).some((v) => typeof v === "string" && v.trim())).length;

  const set = (lang: string, key: string, text: string) => {
    const mine = { ...(value[lang] ?? {}), [key]: text };
    if (!text.trim()) delete mine[key];
    const next = { ...value, [lang]: mine };
    if (!Object.keys(mine).length) delete next[lang];
    onChange(next);
  };

  return (
    <Collapsible defaultOpen={done > 0} className="rounded-lg border">
      <CollapsibleTrigger className="group flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium">
        <ChevronRight className="size-4 transition-transform group-data-[state=open]:rotate-90" />
        Translations
        <span className="ml-auto font-mono text-xs text-muted-foreground">
          {done} of {langs.length}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 border-t px-4 py-4">
        {langs.map((lang) => (
          <fieldset key={lang} className="space-y-2">
            <legend className="mb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <span className="font-mono lowercase">{lang}</span>
              {languageName(lang)}
            </legend>
            {fields.map((f) => {
              const v = String(value[lang]?.[f.key] ?? "");
              const common = {
                "aria-label": `${f.label} in ${languageName(lang)}`,
                value: v,
                placeholder: original[f.key] || f.label,
              };
              return f.multiline ? (
                <Textarea key={f.key} rows={2} {...common} onChange={(e) => set(lang, f.key, e.target.value)} />
              ) : (
                <Input key={f.key} {...common} onChange={(e) => set(lang, f.key, e.target.value)} />
              );
            })}
          </fieldset>
        ))}
        <p className="text-xs text-muted-foreground">Leave a box empty to show the original text in that language.</p>
      </CollapsibleContent>
    </Collapsible>
  );
}
