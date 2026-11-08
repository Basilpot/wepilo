import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { hashPassword, signToken } from "@/lib/auth";
import { accessFor, websiteApiOpen } from "@/lib/billing";
import { API_GRACE_DAYS } from "@/lib/plans";
import { defaultSiteConfig } from "@/lib/site";
import { call, db, makeTenant, makeTrip } from "./helpers";

const DAY = 24 * 60 * 60 * 1000;

async function makeStaff(tenant: schema.Tenant, role: schema.TenantStaff["role"]) {
  const email = `${role.toLowerCase()}-${crypto.randomUUID()}@test.dev`;
  const [staff] = await db()
    .insert(schema.tenantStaff)
    .values({ tenantId: tenant.id, name: role, email, password: tenant.password, role })
    .returning();
  const token = await signToken(env, { kind: "staff", staffId: staff.id, tenantId: tenant.id, role });
  return { staff, token };
}

describe("cross-workspace isolation", () => {
  it("cannot read, change or delete another agency's trip", async () => {
    const a = await makeTenant();
    const b = await makeTenant();
    const { activity } = await makeTrip(a.tenant.id);

    expect((await call(`/api/v1/activities/${activity.id}`, { staff: b.token })).status).toBe(404);
    expect(
      (await call(`/api/v1/activities/${activity.id}`, { method: "PATCH", staff: b.token, body: { title: "Hijacked" } })).status,
    ).toBe(404);
    expect((await call(`/api/v1/activities/${activity.id}`, { method: "DELETE", staff: b.token })).status).toBe(404);

    const row = await db().query.activities.findFirst({ where: eq(schema.activities.id, activity.id) });
    expect(row?.title).toBe("Everest Base Camp");
    expect(row?.tenantId).toBe(a.tenant.id);
  });

  it("cannot read another agency's bookings", async () => {
    const a = await makeTenant();
    const b = await makeTenant();
    const { activity, departure } = await makeTrip(a.tenant.id);
    const created = await call("/api/v1/bookings", {
      slug: a.tenant.slug,
      body: { activityId: activity.id, departureId: departure.id, groupSize: 2, name: "Asha", email: "asha@example.com", phone: "+977 9800000000" },
    });
    expect(created.status).toBe(201);
    const id = created.json.booking.id;

    expect((await call(`/api/v1/bookings/${id}`, { staff: b.token })).status).toBe(404);
    expect((await call(`/api/v1/bookings/${id}/status`, { method: "PATCH", staff: b.token, body: { status: "CONFIRMED" } })).status).toBe(404);
    expect((await call("/api/v1/bookings", { staff: b.token })).json.data).toHaveLength(0);
  });

  it("cannot edit or remove another agency's staff", async () => {
    const a = await makeTenant();
    const b = await makeTenant();

    expect((await call(`/api/v1/tenant/staff/${a.owner.id}`, { method: "PATCH", staff: b.token, body: { name: "Nope" } })).status).toBe(404);
    expect((await call(`/api/v1/tenant/staff/${a.owner.id}`, { method: "DELETE", staff: b.token })).status).toBe(404);

    const owner = await db().query.tenantStaff.findFirst({ where: eq(schema.tenantStaff.id, a.owner.id) });
    expect(owner?.name).toBe("Owner");
    const listed = await call("/api/v1/tenant/staff", { staff: b.token });
    expect(listed.json.data.map((s: { email: string }) => s.email)).not.toContain(a.owner.email);
  });

  it("keeps site config writes inside the signing-in workspace", async () => {
    const a = await makeTenant();
    const b = await makeTenant();
    const config = defaultSiteConfig();
    config.social.instagram = "https://instagram.com/agency-a";

    expect((await call("/api/v1/site/config", { method: "PUT", staff: a.token, body: config })).status).toBe(200);
    const other = defaultSiteConfig();
    other.social.instagram = "https://instagram.com/agency-b";
    expect((await call("/api/v1/site/config", { method: "PUT", staff: b.token, body: other })).status).toBe(200);

    expect((await call("/api/v1/site/config", { staff: a.token })).json.config.social.instagram).toBe("https://instagram.com/agency-a");
    expect((await call("/api/v1/site/config", { staff: b.token })).json.config.social.instagram).toBe("https://instagram.com/agency-b");
  });
});

describe("role permissions", () => {
  it("lets managers edit trips but keeps authors and editors out", async () => {
    const { tenant } = await makeTenant();
    const author = await makeStaff(tenant, "AUTHOR");
    const editor = await makeStaff(tenant, "EDITOR");
    const manager = await makeStaff(tenant, "MANAGER");
    const { activity } = await makeTrip(tenant.id);
    const body = { title: "Renamed" };

    expect((await call(`/api/v1/activities/${activity.id}`, { method: "PATCH", staff: author.token, body })).status).toBe(403);
    expect((await call(`/api/v1/activities/${activity.id}`, { method: "PATCH", staff: editor.token, body })).status).toBe(403);
    expect((await call(`/api/v1/activities/${activity.id}`, { method: "PATCH", staff: manager.token, body })).status).toBe(200);
  });

  it("only lets owners and admins manage staff and billing-critical settings", async () => {
    const { tenant } = await makeTenant();
    const manager = await makeStaff(tenant, "MANAGER");
    const admin = await makeStaff(tenant, "ADMIN");
    const newStaff = { name: "New hire", email: `hire-${crypto.randomUUID()}@test.dev`, password: "password123", role: "EDITOR" };

    expect((await call("/api/v1/tenant/staff", { staff: manager.token, body: newStaff })).status).toBe(403);
    expect((await call("/api/v1/payments/settings/stripe", { method: "POST", staff: manager.token, body: { secretKey: "sk_test_x" } })).status).toBe(403);
    expect((await call("/api/v1/tenant/staff", { staff: admin.token, body: newStaff })).status).toBe(201);
  });

  it("blocks authors from website content but not from their own posts", async () => {
    const { tenant } = await makeTenant();
    const author = await makeStaff(tenant, "AUTHOR");
    const page = { title: "About", slug: `about-${crypto.randomUUID()}`, content: "<p>Hi</p>" };

    expect((await call("/api/v1/info-pages", { staff: author.token, body: page })).status).toBe(403);
    expect((await call("/api/v1/info-pages", { staff: author.token })).status).toBe(403);
  });
});

describe("paywall", () => {
  const now = Date.now();

  it("gives the dashboard a trial but never the website API", () => {
    const access = accessFor(
      { plan: "STARTER", planExpiresAt: new Date(now + DAY), trialUsedAt: new Date(now - DAY), billingMode: "SELF_SERVE" },
      { status: "TRIALING", cancelAtPeriodEnd: false, dodoSubscriptionId: null },
      now,
    );
    expect(access.state).toBe("TRIAL");
    expect(access.locked).toBe(false);
    expect(websiteApiOpen(access, now)).toBe(false);
  });

  it("locks an expired trial", () => {
    const access = accessFor(
      { plan: "STARTER", planExpiresAt: new Date(now - DAY), trialUsedAt: new Date(now - 4 * DAY), billingMode: "SELF_SERVE" },
      { status: "TRIALING", cancelAtPeriodEnd: false, dodoSubscriptionId: null },
      now,
    );
    expect(access.state).toBe("EXPIRED");
    expect(access.locked).toBe(true);
    expect(websiteApiOpen(access, now)).toBe(false);
  });

  it("locks the dashboard as soon as a paid plan lapses but keeps the website up for the grace period", () => {
    const lapsed = new Date(now - 5 * DAY);
    const access = accessFor(
      { plan: "GROWTH", planExpiresAt: lapsed, trialUsedAt: new Date(now - 40 * DAY), billingMode: "SELF_SERVE" },
      { status: "ACTIVE", cancelAtPeriodEnd: false, dodoSubscriptionId: "sub_1" },
      now,
    );
    expect(access.locked).toBe(true);
    expect(access.apiUntil?.getTime()).toBe(lapsed.getTime() + API_GRACE_DAYS * DAY);
    expect(websiteApiOpen(access, now)).toBe(true);
    expect(websiteApiOpen(access, lapsed.getTime() + (API_GRACE_DAYS + 1) * DAY)).toBe(false);
  });

  it("stops the website once the grace period is over", () => {
    const access = accessFor(
      { plan: "STARTER", planExpiresAt: new Date(now - (API_GRACE_DAYS + 1) * DAY), trialUsedAt: new Date(now - 60 * DAY), billingMode: "SELF_SERVE" },
      { status: "EXPIRED", cancelAtPeriodEnd: false, dodoSubscriptionId: "sub_2" },
      now,
    );
    expect(access.locked).toBe(true);
    expect(websiteApiOpen(access, now)).toBe(false);
  });

  it("keeps a hand-managed workspace open while its plan has no end date", () => {
    const access = accessFor({ plan: "ENTERPRISE", planExpiresAt: null, trialUsedAt: null, billingMode: "MANUAL" }, null, now);
    expect(access.state).toBe("ACTIVE");
    expect(access.locked).toBe(false);
    expect(websiteApiOpen(access, now)).toBe(true);
  });
});

describe("paywall at the route level", () => {
  async function setAccess(
    tenantId: number,
    tenantPatch: Partial<typeof schema.tenants.$inferInsert>,
    sub?: Partial<typeof schema.platformSubscriptions.$inferInsert>,
  ) {
    await db().update(schema.tenants).set(tenantPatch).where(eq(schema.tenants.id, tenantId));
    if (sub) await db().insert(schema.platformSubscriptions).values({ tenantId, plan: "STARTER", ...sub });
  }

  it("locks the dashboard behind 402 for expired and unpaid workspaces", async () => {
    const { tenant, token } = await makeTenant();
    await setAccess(tenant.id, { plan: "STARTER", planExpiresAt: new Date(Date.now() - DAY), trialUsedAt: new Date(Date.now() - 10 * DAY), billingMode: "SELF_SERVE" });

    const res = await call("/api/v1/bookings", { staff: token });
    expect(res.status).toBe(402);
    expect(res.json.code).toBe("PAYMENT_REQUIRED");
  });

  it("opens the dashboard during the trial but refuses the website API", async () => {
    const { tenant, token } = await makeTenant();
    await setAccess(
      tenant.id,
      { plan: "STARTER", planExpiresAt: new Date(Date.now() + DAY), trialUsedAt: new Date(), billingMode: "SELF_SERVE" },
      { status: "TRIALING" },
    );

    expect((await call("/api/v1/bookings", { staff: token })).status).toBe(200);
    const website = await call("/api/v1/site", { slug: tenant.slug });
    expect(website.status).toBe(402);
    expect(website.json.code).toBe("API_ACCESS_INACTIVE");
  });

  it("locks the dashboard immediately but serves the website during the grace period", async () => {
    const { tenant, token } = await makeTenant();
    await setAccess(
      tenant.id,
      { plan: "GROWTH", planExpiresAt: new Date(Date.now() - 2 * DAY), trialUsedAt: new Date(Date.now() - 40 * DAY), billingMode: "SELF_SERVE" },
      { plan: "GROWTH", status: "ACTIVE", dodoSubscriptionId: `sub_${tenant.id}` },
    );

    expect((await call("/api/v1/bookings", { staff: token })).status).toBe(402);
    expect((await call("/api/v1/site", { slug: tenant.slug })).status).toBe(200);
  });

  it("takes the website down once the grace period has passed", async () => {
    const { tenant } = await makeTenant();
    await setAccess(
      tenant.id,
      { plan: "STARTER", planExpiresAt: new Date(Date.now() - (API_GRACE_DAYS + 1) * DAY), trialUsedAt: new Date(Date.now() - 60 * DAY), billingMode: "SELF_SERVE" },
      { status: "EXPIRED", dodoSubscriptionId: `sub_${tenant.id}` },
    );

    expect((await call("/api/v1/site", { slug: tenant.slug })).status).toBe(402);
  });
});
