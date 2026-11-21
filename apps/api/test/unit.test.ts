import { describe, expect, it } from "vitest";
import { isIsoDate } from "@/lib/dates";
import { overlay, mergeTranslation } from "@/lib/i18n";
import { publishFields } from "@/lib/publish";
import { isTrustedOrigin } from "@/lib/origin";
import { likePattern } from "@/lib/http";

describe("dates", () => {
  it("checks real calendar dates", () => {
    expect(isIsoDate("2026-02-28")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("10/02/2026")).toBe(false);
  });
});

describe("translations", () => {
  const trip = {
    title: "Inca Trail",
    overview: "Four days to Machu Picchu.",
    tripSeo: { metaTitle: "Inca Trail, 4 days", metaDescription: "Hike to Machu Picchu." },
    tripCategory: { name: "Treks", translations: { es: { name: "Caminatas" } } },
    translations: { es: { title: "Camino Inca", overview: "", tripSeo: { metaTitle: "Camino Inca, 4 días" } } },
  };
  it("lays one language over the original, keeping untranslated fields", () => {
    const out = overlay(trip, "es") as Record<string, any>;
    expect(out.title).toBe("Camino Inca");
    expect(out.overview).toBe("Four days to Machu Picchu.");
    expect(out.tripSeo).toEqual({ metaTitle: "Camino Inca, 4 días", metaDescription: "Hike to Machu Picchu." });
    expect(out.tripCategory.name).toBe("Caminatas");
    expect(out.translations).toBeUndefined();
  });
  it("falls back to the original for a language nobody translated", () => {
    expect((overlay(trip, "de") as Record<string, any>).title).toBe("Inca Trail");
  });
  it("merges one language and drops emptied fields", () => {
    const merged = mergeTranslation({ es: { title: "Camino Inca", overview: "Cuatro días" } }, "es", { overview: "" , faq: [{ q: "¿Altura?" }] });
    expect(merged).toEqual({ es: { title: "Camino Inca", faq: [{ q: "¿Altura?" }] } });
    expect(mergeTranslation({ de: { title: "Inka" } }, "de", { title: "" })).toEqual({});
  });
});

describe("publishing", () => {
  it("publishing now clears any schedule and stamps the time", () => {
    const f = publishFields({ goingLive: true, wasLive: false, publishAt: new Date("2099-01-01") });
    expect(f.publishAt).toBeNull();
    expect(f).toHaveProperty("publishedAt");
  });
  it("schedules a draft", () => {
    const at = new Date("2099-01-01T09:00:00Z");
    expect(publishFields({ goingLive: undefined, wasLive: false, publishAt: at })).toEqual({ publishAt: at });
  });
  it("refuses to schedule something already live", () => {
    expect(() => publishFields({ goingLive: undefined, wasLive: true, publishAt: new Date("2099-01-01") })).toThrow(/already live/);
  });
});

describe("trusted origins", () => {
  const env = {
    DASHBOARD_URL: "https://app.wepilo.test",
    SITE_URL: "https://wepilo.test",
    API_BASE_URL: "https://api.wepilo.test",
    ENVIRONMENT: "production",
  };
  it("accepts own apps, rejects others and production localhost", () => {
    expect(isTrustedOrigin(env, "https://app.wepilo.test")).toBe(true);
    expect(isTrustedOrigin(env, undefined)).toBe(true);
    expect(isTrustedOrigin(env, "https://evil.test")).toBe(false);
    expect(isTrustedOrigin(env, "http://localhost:5173")).toBe(false);
    expect(isTrustedOrigin({ ...env, ENVIRONMENT: "development" }, "http://localhost:5173")).toBe(true);
  });
});

describe("likePattern", () => {
  it("escapes wildcards", () => {
    expect(likePattern("50%_off\\")).toBe("%50\\%\\_off\\\\%");
  });
});
