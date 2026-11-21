import { normalizeFaq, normalizeInfo, toPayload, type ItineraryVariant, type TripForm } from "./trip-form";

/**
 * Trip translations in the editor
 * -------------------------------
 * A trip keeps its original text in its own fields and a `translations` map:
 * `{ de: { title, overview, itinerary, … } }` (see the API's lib/i18n.ts). The editor edits one
 * language at a time with the same screens: switching to German loads a TripForm made of the
 * original with the German text laid over it, and saving keeps only the text that differs from
 * the original, so anything left untranslated keeps following the original.
 */

export type Translations = Record<string, Record<string, unknown>>;

/** Steps that hold text worth translating. The rest (photos, prices, dates) belong to the original. */
export const TEXT_STEPS = new Set(["basics", "overview", "highlights", "itinerary", "map", "inclusions", "exclusions", "duration", "info", "faq", "seo", "content"]);

const TEXT_KEYS = ["title", "overview", "content", "highlights", "inclusions", "exclusions", "duration", "meetingPoint", "dropOffPoint", "mapDescription", "additionalInfo", "faq"] as const;

const str = (v: unknown) => (typeof v === "string" ? v : "");

/** Language names in the person's own language: "de" → "German" (or "Deutsch" for a German browser). */
export function languageName(code: string, inLanguage?: string) {
  try {
    const name = new Intl.DisplayNames([inLanguage ?? navigator.language, "en"], { type: "language" }).of(code);
    return name ? name.charAt(0).toUpperCase() + name.slice(1) : code;
  } catch {
    return code;
  }
}

/** Lays one translated itinerary over the original: text from the translation, everything else (ids, photos) from the original. */
function mergeItinerary(base: ItineraryVariant[], translated: unknown): ItineraryVariant[] {
  if (!Array.isArray(translated)) return base;
  return base.map((variant, vi) => {
    const t = (translated[vi] ?? {}) as Record<string, unknown>;
    const tDays = Array.isArray(t.days) ? (t.days as Record<string, unknown>[]) : [];
    return {
      ...variant,
      name: str(t.name) || variant.name,
      description: str(t.description) || variant.description,
      days: variant.days.map((day, di) => {
        const td = tDays[di] ?? {};
        return {
          ...day,
          title: str(td.title) || day.title,
          description: str(td.description) || day.description,
          meals: str(td.meals) || day.meals,
          accommodations: str(td.accommodations) || day.accommodations,
        };
      }),
    };
  });
}

/** The form for one language: the original with that language's text laid over it. */
export function applyTranslation(base: TripForm, t: Record<string, unknown> | undefined): TripForm {
  if (!t) return base;
  const out: TripForm = { ...base, seo: { ...base.seo } };
  for (const key of ["title", "overview", "content", "highlights", "inclusions", "exclusions", "duration", "meetingPoint", "dropOffPoint", "mapDescription"] as const) {
    const v = str(t[key]);
    if (v) out[key] = v;
  }
  if (Array.isArray(t.additionalInfo) && t.additionalInfo.length) out.additionalInfo = normalizeInfo(t.additionalInfo);
  if (Array.isArray(t.faq) && t.faq.length) out.faq = normalizeFaq(t.faq);
  out.itinerary = mergeItinerary(base.itinerary, t.itinerary);
  const seo = (t.tripSeo ?? {}) as Record<string, unknown>;
  if (str(seo.metaTitle)) out.seo.metaTitle = str(seo.metaTitle);
  if (str(seo.metaDescription)) out.seo.metaDescription = str(seo.metaDescription);
  return out;
}

/** What a language actually changes: only the text fields that differ from the original. */
export function diffTranslation(base: TripForm, translated: TripForm): Record<string, unknown> {
  const a = toPayload(base, "DRAFT");
  const b = toPayload(translated, "DRAFT");
  const out: Record<string, unknown> = {};
  for (const key of TEXT_KEYS) {
    if (JSON.stringify(a[key]) !== JSON.stringify(b[key]) && b[key] !== null && b[key] !== "") out[key] = b[key];
  }
  // The itinerary is kept whole when any of its text changed, so days line up by position.
  const text = (it: unknown) =>
    JSON.stringify(
      (it as Array<{ name: string; description: string; days: Array<{ title: string; description: string; meals: string; accommodations: string }> }>).map((v) => [
        v.name,
        v.description,
        v.days.map((d) => [d.title, d.description, d.meals, d.accommodations]),
      ]),
    );
  if (text(a.itinerary) !== text(b.itinerary)) out.itinerary = b.itinerary;
  const seoA = a.tripSeo as Record<string, unknown>;
  const seoB = b.tripSeo as Record<string, unknown>;
  const seo: Record<string, unknown> = {};
  if (seoB.metaTitle && seoB.metaTitle !== seoA.metaTitle) seo.metaTitle = seoB.metaTitle;
  if (seoB.metaDescription && seoB.metaDescription !== seoA.metaDescription) seo.metaDescription = seoB.metaDescription;
  if (Object.keys(seo).length) out.tripSeo = seo;
  return out;
}

/** Drops languages with nothing in them, so an untouched language doesn't look translated. */
export function compact(t: Translations): Translations {
  return Object.fromEntries(Object.entries(t).filter(([, v]) => v && Object.keys(v).length > 0));
}
