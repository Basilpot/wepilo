import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { defaultSiteConfig, readSiteConfig } from "@/lib/site";
import { call, db, makeTenant, makeTrip } from "./helpers";

describe("site config", () => {
  it("falls back to defaults for missing or malformed stored values", () => {
    expect(readSiteConfig(null)).toEqual(defaultSiteConfig());
    expect(readSiteConfig({ homepage: "nonsense" })).toEqual(defaultSiteConfig());
    const merged = readSiteConfig({ social: { instagram: "https://instagram.com/x" } });
    expect(merged.social.instagram).toBe("https://instagram.com/x");
    expect(merged.homepage.sections.length).toBeGreaterThan(0);
  });

  it("saves a config, rejects duplicate section ids and bad enums", async () => {
    const { token } = await makeTenant();
    const config = defaultSiteConfig();
    const ok = await call("/api/v1/site/config", { method: "PUT", staff: token, body: config });
    expect(ok.status).toBe(200);

    const dup = { ...config, homepage: { sections: [config.homepage.sections[0], config.homepage.sections[0]] } };
    expect((await call("/api/v1/site/config", { method: "PUT", staff: token, body: dup })).status).toBe(400);

    const bad = { ...config, homepage: { sections: [{ id: "x", type: "NOPE", enabled: true }] } };
    expect((await call("/api/v1/site/config", { method: "PUT", staff: token, body: bad })).status).toBe(400);
  });
});

describe("public site payload", () => {
  it("resolves homepage sections and automatic menus from published content only", async () => {
    const { tenant, token } = await makeTenant();
    const { activity } = await makeTrip(tenant.id);
    await db().update(schema.activities).set({ isFeatured: true }).where(eq(schema.activities.id, activity.id));
    // A draft featured trip must not leak.
    await db().insert(schema.activities).values({ tenantId: tenant.id, title: "Secret draft", slug: "secret", status: "DRAFT", isFeatured: true });
    await db().insert(schema.tripCategories).values({ tenantId: tenant.id, handle: "trek", name: "Trekking", showOnHomepage: true });
    await db().insert(schema.infoPages).values([
      { tenantId: tenant.id, title: "About us", slug: "about", published: true, featuredInNavbar: true },
      { tenantId: tenant.id, title: "Hidden", slug: "hidden", published: false, featuredInNavbar: true },
    ]);
    await db().insert(schema.testimonials).values({ tenantId: tenant.id, content: "Great", author: "Sam", rating: 5 });
    void token;

    const res = await call("/api/v1/site", { slug: tenant.slug });
    expect(res.status).toBe(200);
    const sections = res.json.homepage as Array<{ type: string; data?: Array<{ title?: string; url?: string; name?: string }> }>;
    const featured = sections.find((s) => s.type === "FEATURED_TRIPS")!;
    expect(featured.data?.map((t) => t.title)).toEqual(["Everest Base Camp"]);
    expect(featured.data?.[0].url).toBe(`/trips/${activity.slug}`);
    expect(sections.find((s) => s.type === "CATEGORIES")!.data?.[0].name).toBe("Trekking");
    expect(sections.find((s) => s.type === "TESTIMONIALS")!.data).toHaveLength(1);

    const header = res.json.navigation.header as Array<{ label: string; children?: Array<{ href: string }> }>;
    expect(header.map((i) => i.label)).toEqual(["Trips", "Blog", "About us"]);
    expect(header[0].children?.[0].href).toBe("/trips/category/trek");
    expect(JSON.stringify(res.json)).not.toContain("Hidden");
    expect(res.headers.get("cache-control")).toContain("max-age");
  });

  it("honours manual menus, custom paths and disabled sections", async () => {
    const { tenant, token } = await makeTenant();
    const config = defaultSiteConfig();
    config.homepage.sections = config.homepage.sections.map((s) => (s.type === "NEWSLETTER" ? { ...s, enabled: false } : s));
    config.navigation.header = { mode: "MANUAL", items: [{ label: "Shop", href: "https://shop.test" }] };
    config.paths.trip = "/tours/{slug}";
    await call("/api/v1/site/config", { method: "PUT", staff: token, body: config });
    const { activity } = await makeTrip(tenant.id);
    await db().update(schema.activities).set({ isFeatured: true }).where(eq(schema.activities.id, activity.id));

    const res = await call("/api/v1/site", { slug: tenant.slug });
    expect(res.json.navigation.header).toEqual([{ label: "Shop", href: "https://shop.test" }]);
    const types = (res.json.homepage as Array<{ type: string }>).map((s) => s.type);
    expect(types).not.toContain("NEWSLETTER");
    const featured = (res.json.homepage as Array<{ type: string; data: Array<{ url: string }> }>).find((s) => s.type === "FEATURED_TRIPS")!;
    expect(featured.data[0].url).toBe(`/tours/${activity.slug}`);
  });
});

describe("saved sections and templates", () => {
  it("are per agency", async () => {
    const a = await makeTenant();
    const b = await makeTenant();
    const created = await call("/api/v1/saved-sections", { staff: a.token, body: { name: "Arrival day", data: { title: "Day 1" } } });
    expect(created.status).toBe(201);
    expect((await call("/api/v1/saved-sections", { staff: b.token })).json.data).toHaveLength(0);
    expect((await call(`/api/v1/saved-sections/${created.json.section.id}`, { method: "DELETE", staff: b.token })).status).toBe(200);
    expect((await call("/api/v1/saved-sections", { staff: a.token })).json.data).toHaveLength(1);

    const tpl = await call("/api/v1/templates", { staff: a.token, body: { name: "Packing list", content: "<ul><li>Boots</li></ul>" } });
    expect(tpl.status).toBe(201);
    const renamed = await call(`/api/v1/templates/${tpl.json.template.id}`, { method: "PATCH", staff: a.token, body: { name: "Gear" } });
    expect(renamed.json.template.name).toBe("Gear");
    expect((await call(`/api/v1/templates/${tpl.json.template.id}`, { method: "PATCH", staff: b.token, body: { name: "x" } })).status).toBe(404);
  });
});
