import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { signToken } from "@/lib/auth";
import { publishDue } from "@/lib/publish";
import { call, db, makeTenant, makeTrip } from "./helpers";

async function staffToken(tenantId: number, role: "EDITOR" | "AUTHOR") {
  const [staff] = await db()
    .insert(schema.tenantStaff)
    .values({ tenantId, name: role, email: `${role.toLowerCase()}-${Date.now()}-${Math.random()}@test.dev`, password: "unused", role })
    .returning();
  return signToken(env, { kind: "staff", staffId: staff.id, tenantId, role });
}

describe("publishing and scheduling", () => {
  it("lets authors draft but not publish or schedule", async () => {
    const { tenant } = await makeTenant();
    const author = await staffToken(tenant.id, "AUTHOR");
    const draft = await call("/api/v1/blogs", { staff: author, body: { title: "Packing for Kilimanjaro", content: "<p>Layers.</p>" } });
    expect(draft.status).toBe(201);
    const id = draft.json.post.id;
    expect((await call(`/api/v1/blogs/${id}`, { method: "PATCH", staff: author, body: { published: true } })).json.code).toBe("CANNOT_PUBLISH");
    expect((await call(`/api/v1/blogs/${id}`, { method: "PATCH", staff: author, body: { publishAt: "2099-01-01T09:00:00Z" } })).status).toBe(403);

    const editor = await staffToken(tenant.id, "EDITOR");
    const live = await call(`/api/v1/blogs/${id}`, { method: "PATCH", staff: editor, body: { published: true } });
    expect(live.status).toBe(200);
    expect(live.json.post.published).toBe(true);
    expect(live.json.post.publishedAt).toBeTruthy();
  });

  it("puts scheduled drafts live when their time comes, and not before", async () => {
    const { tenant, token } = await makeTenant();
    const soon = new Date(Date.now() + 60_000).toISOString();
    const post = await call("/api/v1/blogs", { staff: token, body: { title: "Spring departures", content: "<p>New dates.</p>", publishAt: soon } });
    expect(post.status).toBe(201);
    expect(post.json.post.published).toBe(false);

    expect((await publishDue(db(), new Date())).posts).toBe(0);
    const result = await publishDue(db(), new Date(Date.now() + 120_000));
    expect(result.posts).toBeGreaterThanOrEqual(1);
    const row = await db().query.blogs.findFirst({ where: eq(schema.blogs.id, post.json.post.id) });
    expect(row?.published).toBe(true);
    expect(row?.publishAt).toBeNull();
    expect(row?.publishedAt?.toISOString()).toBe(soon);
  });

  it("refuses to schedule a trip that is already live", async () => {
    const { tenant, token } = await makeTenant();
    const { activity } = await makeTrip(tenant.id);
    const res = await call(`/api/v1/activities/${activity.id}`, { method: "PATCH", staff: token, body: { publishAt: "2099-01-01T09:00:00Z" } });
    expect(res.status).toBe(409);
    expect(res.json.code).toBe("ALREADY_PUBLISHED");
  });

  it("shows scheduled content and departures on the calendar", async () => {
    const { tenant, token } = await makeTenant();
    await makeTrip(tenant.id, { startDate: "2099-03-10" });
    await call("/api/v1/blogs", { staff: token, body: { title: "March news", content: "<p>…</p>", publishAt: "2099-03-05T08:00:00Z" } });
    const cal = await call("/api/v1/calendar?from=2099-03-01&to=2099-03-31", { staff: token });
    expect(cal.status).toBe(200);
    expect(cal.json.items.map((i: { kind: string; state: string }) => `${i.kind}:${i.state}`)).toEqual(["post:scheduled", "departure:open"]);
  });
});

describe("languages", () => {
  it("serves a translation with ?lang and falls back to the original", async () => {
    const { tenant, token } = await makeTenant();
    const { activity } = await makeTrip(tenant.id);
    await call(`/api/v1/activities/${activity.id}`, {
      method: "PATCH",
      staff: token,
      body: { overview: "Twelve days to base camp.", translations: { de: { title: "Everest-Basislager" } } },
    });
    await call("/api/v1/tenant/languages", { method: "PUT", staff: token, body: { defaultLanguage: "en", languages: ["de", "en", "de"] } });

    const de = await call(`/api/v1/activities/${activity.id}?lang=de`, { slug: tenant.slug });
    expect(de.json.activity.title).toBe("Everest-Basislager");
    expect(de.json.activity.overview).toBe("Twelve days to base camp.");
    expect(de.json.activity.translations).toBeUndefined();
    expect(de.headers.get("content-language")).toBe("de");

    const plain = await call(`/api/v1/activities/${activity.id}`, { slug: tenant.slug });
    expect(plain.json.activity.title).toBe("Everest Base Camp");

    const site = await call("/api/v1/site", { slug: tenant.slug });
    expect(site.json.languages).toEqual({ default: "en", available: ["en", "de"] });
  });
});

describe("departures without bookings", () => {
  it("follows the seats left the agency sets", async () => {
    const { tenant, token } = await makeTenant();
    const { departure } = await makeTrip(tenant.id, { capacity: 10 });
    const full = await call(`/api/v1/departures/${departure.id}`, { method: "PATCH", staff: token, body: { seatsLeft: 0 } });
    expect(full.json.departure.status).toBe("FULL");
    const open = await call(`/api/v1/departures/${departure.id}`, { method: "PATCH", staff: token, body: { seatsLeft: 3 } });
    expect(open.json.departure.status).toBe("OPEN");
    expect((await call(`/api/v1/departures/${departure.id}`, { method: "PATCH", staff: token, body: { seatsLeft: 11 } })).status).toBe(400);
  });

  it("emails enquiries instead of storing them", async () => {
    const { tenant } = await makeTenant();
    const res = await call("/api/v1/inquiries", {
      slug: tenant.slug,
      body: { name: "Kenji", email: "kenji@example.jp", trip: "Kilimanjaro", departureDate: "2099-01-10", travellers: 2, message: "Two seats?" },
    });
    expect(res.status).toBe(202);
    expect(res.json).toEqual({ ok: true });
  });
});
