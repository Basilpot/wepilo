import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { languageName, type Translations } from "@/lib/translations";
import { cn } from "@/lib/utils";

/** The workspace's languages. Editors only show a switch when there's more than one. */
export function useWorkspaceLanguages() {
  return useQuery({
    queryKey: ["languages"],
    queryFn: () => api<{ defaultLanguage: string; languages: string[] }>("/tenant/languages"),
    staleTime: 5 * 60_000,
  });
}

/**
 * `en · de · es`: which language an editor is showing. A filled dot means that language has a
 * translation; an empty one means it still shows the original.
 */
export function LanguageSwitch({
  value,
  onChange,
  translations,
}: {
  value: string | null;
  onChange: (lang: string | null) => void;
  translations: Translations;
}) {
  const { data } = useWorkspaceLanguages();
  const extra = data?.languages ?? [];
  if (!extra.length) return null;
  const def = data?.defaultLanguage ?? "en";
  return (
    <div role="group" aria-label="Language you are editing" className="flex items-center gap-1 rounded-lg border p-0.5">
      {[null, ...extra].map((code) => {
        const filled = code ? Boolean(translations[code]) : true;
        return (
          <button
            key={code ?? "original"}
            type="button"
            aria-pressed={value === code}
            title={code ? `${languageName(code)}${filled ? "" : " (not translated yet)"}` : `${languageName(def)} (original)`}
            onClick={() => onChange(code)}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 font-mono text-xs lowercase transition-colors",
              value === code ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {code ?? def}
            {code && <span aria-hidden className={cn("size-1.5 rounded-full", filled ? "bg-primary" : "bg-border")} />}
          </button>
        );
      })}
    </div>
  );
}

/** Shown on parts of an editor that are the same in every language. */
export function SameInEveryLanguage() {
  const { data } = useWorkspaceLanguages();
  return (
    <p className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
      This is the same in every language. Switch to {languageName(data?.defaultLanguage ?? "en")} (original) to change it.
    </p>
  );
}
