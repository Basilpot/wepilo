import { useMemo, useState } from "react";

/**
 * Editing a record in several languages
 * -------------------------------------
 * Records keep their original text in their own fields and a `translations` map of only the
 * fields someone translated: `{ de: { title: "…", content: "…" } }`. Anything missing falls back
 * to the original on the website (the API's `?lang=de`).
 *
 * This hook lets an editor reuse its own form for every language. While a translation is open,
 * `form` holds that language and the original waits aside; switching back restores it. Only the
 * translatable `keys` that differ from the original are kept.
 */
export type Translations = Record<string, Record<string, unknown>>;

const hasText = (v: unknown) => !(v === null || v === undefined || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0));

/** Drops languages with nothing in them. */
export const compactTranslations = (t: Translations): Translations =>
  Object.fromEntries(Object.entries(t).filter(([, v]) => v && Object.keys(v).length > 0));

export function useLanguageEditing<F extends Record<string, unknown>>(form: F, setForm: (f: F) => void, keys: Array<keyof F & string>) {
  const [lang, setLang] = useState<string | null>(null);
  const [base, setBase] = useState<F | null>(null);
  const [translations, setTranslations] = useState<Translations>({});

  const diff = (b: F, t: F) => {
    const out: Record<string, unknown> = {};
    for (const k of keys) if (hasText(t[k]) && JSON.stringify(t[k]) !== JSON.stringify(b[k])) out[k] = t[k];
    return out;
  };
  const apply = (b: F, t: Record<string, unknown> | undefined): F => {
    const out = { ...b };
    for (const k of keys) if (t && hasText(t[k])) (out as Record<string, unknown>)[k] = t[k];
    return out;
  };

  const original = lang ? (base ?? form) : form;
  const current = useMemo(
    () => compactTranslations(lang ? { ...translations, [lang]: diff(base ?? form, form) } : translations),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lang, translations, base, form],
  );

  return {
    /** The language being edited; null is the original. */
    lang,
    /** The original form, whichever language is open. */
    original,
    /** Every language's translation, including what's being typed now. */
    translations: current,
    /** Load what the server returned. */
    load(t: unknown) {
      setTranslations(compactTranslations((t as Translations | null) ?? {}));
      setLang(null);
      setBase(null);
    },
    /** Open another language, or the original with null. Typed text in this one is kept. */
    switchTo(next: string | null) {
      if (next === lang) return;
      const b = lang ? (base ?? form) : form;
      const kept = lang ? { ...translations, [lang]: diff(b, form) } : translations;
      setTranslations(kept);
      if (next === null) {
        setForm(b);
        setBase(null);
      } else {
        setBase(b);
        setForm(apply(b, kept[next]));
      }
      setLang(next);
    },
    /** After saving, the original may have changed on the server (a new slug). */
    replaceOriginal(next: F) {
      if (lang) setBase(next);
      else setForm(next);
      setTranslations(current);
    },
  };
}

/** "de" → "German" (in the person's own language). */
export function languageName(code: string) {
  try {
    const name = new Intl.DisplayNames([navigator.language, "en"], { type: "language" }).of(code);
    return name ? name.charAt(0).toUpperCase() + name.slice(1) : code;
  } catch {
    return code;
  }
}
