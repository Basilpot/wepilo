import type { MiddlewareHandler } from "hono";
import { z } from "zod";
import type { AppEnv } from "@/types";

/**
 * Translations
 * ------------
 * Every translatable record keeps its original text in its own columns and a `translations`
 * JSON object keyed by language: `{ de: { title: "…", overview: "…" }, es: { … } }`.
 * A translation only holds the fields someone translated; anything missing falls back to
 * the original. The same shape is used for nested objects (a trip's SEO, homepage sections,
 * menu items), so one overlay handles them all.
 */

/** Language codes we accept: "de", "es", "pt-BR", "zh-Hant". */
export const LANG_CODE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,4})?$/;
export const langCode = z.string().regex(LANG_CODE, "use a language code like de, es or pt-BR");

/** `{ [lang]: { field: value } }`, the stored shape of `translations`. */
export const translationsSchema = z.record(langCode, z.record(z.string(), z.any()));

/** The fields a person can translate on each kind of record. The dashboard and the MCP tools use the same lists. */
export const TRANSLATABLE = {
  trip: [
    "title",
    "overview",
    "content",
    "highlights",
    "inclusions",
    "exclusions",
    "itinerary",
    "additionalInfo",
    "faq",
    "duration",
    "bestSeason",
    "meetingPoint",
    "dropOffPoint",
    "transportation",
    "meals",
    "mapDescription",
    "tripSeo",
  ],
  post: ["title", "content", "metaTitle", "metaDescription"],
  page: ["title", "content", "metaTitle", "metaDescription"],
  taxonomy: ["name", "description"],
  extra: ["name", "description"],
} as const;

const isPlainObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** A translated value counts only if someone actually filled it in. */
const hasValue = (v: unknown) =>
  v !== null && v !== undefined && !(typeof v === "string" && v.trim() === "") && !(Array.isArray(v) && v.length === 0);

/**
 * Lays the `lang` translation over every record in `value`, at any depth, and drops the
 * `translations` maps from the result. Untranslated fields keep the original text.
 */
export function overlay(value: unknown, lang: string): unknown {
  if (Array.isArray(value)) return value.map((v) => overlay(v, lang));
  if (!isPlainObject(value)) return value;

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (k === "translations") continue;
    out[k] = overlay(v, lang);
  }
  const t = isPlainObject(value.translations) ? value.translations[lang] : undefined;
  if (isPlainObject(t)) {
    for (const [k, v] of Object.entries(t)) {
      if (!hasValue(v)) continue;
      // Nested objects (a trip's SEO) merge; everything else replaces.
      out[k] = isPlainObject(v) && isPlainObject(out[k]) ? { ...(out[k] as object), ...v } : v;
    }
  }
  return out;
}

/**
 * Public reads in another language: `GET …?lang=de` returns every record with its German
 * text laid over the original. Without `lang` the response is unchanged, so existing sites
 * keep working. The dashboard never passes `lang`; it edits the raw `translations` maps.
 */
export function localize(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    await next();
    const lang = c.req.query("lang");
    if (c.req.method !== "GET" || !lang || !LANG_CODE.test(lang)) return;
    if (!c.res.headers.get("content-type")?.includes("application/json")) return;
    const body = await c.res.clone().json().catch(() => undefined);
    if (body === undefined) return;
    const headers = new Headers(c.res.headers);
    headers.set("Content-Language", lang);
    headers.delete("content-length");
    c.res = new Response(JSON.stringify(overlay(body, lang)), { status: c.res.status, headers });
  };
}

/**
 * Merges one language's fields into a stored translations map, for tools that write a single
 * language at a time. Empty values remove that field from the translation.
 */
export function mergeTranslation(current: unknown, lang: string, fields: Record<string, unknown>) {
  const all = isPlainObject(current) ? { ...current } : {};
  const mine = isPlainObject(all[lang]) ? { ...(all[lang] as Record<string, unknown>) } : {};
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue;
    if (hasValue(v)) mine[k] = v;
    else delete mine[k];
  }
  if (Object.keys(mine).length) all[lang] = mine;
  else delete all[lang];
  return all;
}
