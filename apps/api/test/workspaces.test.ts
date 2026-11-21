import { describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { hashPassword, signToken } from "@/lib/auth";
import { issueStaffToken } from "@/lib/staff-tokens";
import { call, db } from "./helpers";

let seq = 0;

type Workspace = { tenant: schema.Tenant; owner: schema.TenantStaff };

/** A workspace owned by someone with the given email and password. */
async function makeWorkspace(opts: {
  email: string;
  password: string;
  name?: string;
  plan?: "STARTER" | "ENTERPRISE";
  billingMode?: "SELF_SERVE" | "MANUAL";
  trialUsedAt?: Date | null;
  trialEmail?: string | null;
}): Promise<Workspace> {
  const passwordHash = await hashPassword(opts.password);
  const [tenant] = await db()
    .insert(schema.tenants)
    .values({
      email: opts.email,
      companyName: opts.name ?? `Agency ${++seq}`,
      slug: `agency-${seq}-${Date.now()}`,
      status: "ACTIVE",
      plan: opts.plan ?? "ENTERPRISE",
      billingMode: opts.billingMode ?? "MANUAL",
      trialUsedAt: opts.trialUsedAt ?? null,
      trialEmail: opts.trialEmail ?? null,
    })
    .returning();
  const [owner] = await db()
    .insert(schema.tenantStaff)
    .values({ tenantId: tenant.id, name: opts.name ?? "Owner", email: opts.email, password: passwordHash, role: "OWNER" })
    .returning();
  return { tenant, owner };
}

/** A teammate in a workspace, with their own login. */
async function makeMember(tenantId: number, email: string, password: string, role: schema.TenantStaff["role"] = "EDITOR") {
  const [member] = await db()
    .insert(schema.tenantStaff)
    .values({ tenantId, name: "Teammate", email, password: await hashPassword(password), role })
    .returning();
  return member;
}

function cookieToken(headers: Headers) {
  const raw = headers.get("set-cookie") ?? "";
  return /wepilo_staff_token=([^;]+)/.exec(raw)?.[1] ?? "";
}

describe("one account, several workspaces", () => {
  it("signs in once and lists every workspace the person can open", async () => {
    const email = `owner-${Date.now()}@test.dev`;
    const first = await makeWorkspace({ email, password: "password123", name: "First agency" });
    const second = await makeWorkspace({ email, password: "password123", name: "Second agency" });

    const res = await call("/api/v1/auth/login", { method: "POST", body: { email, password: "password123" } });
    expect(res.status).toBe(200);
    expect(res.json.workspaces.map((w: { id: number }) => w.id)).toEqual([first.tenant.id, second.tenant.id]);
    expect(res.json.workspaces[0].role).toBe("OWNER");
  });

  it("lets a teammate sign in, which the old owner-only login refused", async () => {
    const email = `editor-${Date.now()}@test.dev`;
    const { tenant } = await makeWorkspace({ email: `owner-${Date.now()}@test.dev`, password: "password123" });
    const member = await makeMember(tenant.id, email, "password123");

    const res = await call("/api/v1/auth/login", { method: "POST", body: { email, password: "password123" } });
    expect(res.status).toBe(200);
    expect(res.json.staff.role).toBe("EDITOR");
    expect(res.json.staff.id).toBe(member.id);
  });

  it("opens the workspace the person asked for", async () => {
    const email = `owner-${Date.now()}@test.dev`;
    const first = await makeWorkspace({ email, password: "password123" });
    const second = await makeWorkspace({ email, password: "password123" });

    const res = await call("/api/v1/auth/login", {
      method: "POST",
      body: { email, password: "password123", tenantId: second.tenant.id },
    });
    expect(res.status).toBe(200);
    expect(res.json.tenant.id).toBe(second.tenant.id);
    expect(first.tenant.id).not.toBe(second.tenant.id);
  });

  it("refuses the wrong password", async () => {
    const email = `owner-${Date.now()}@test.dev`;
    await makeWorkspace({ email, password: "password123" });
    const res = await call("/api/v1/auth/login", { method: "POST", body: { email, password: "wrong-password" } });
    expect(res.status).toBe(401);
  });

  it("signs in past a suspended workspace", async () => {
    const email = `owner-${Date.now()}@test.dev`;
    const first = await makeWorkspace({ email, password: "password123", name: "Suspended agency" });
    const second = await makeWorkspace({ email, password: "password123", name: "Working agency" });
    await db().update(schema.tenants).set({ status: "SUSPENDED" }).where(eq(schema.tenants.id, first.tenant.id));

    const res = await call("/api/v1/auth/login", { method: "POST", body: { email, password: "password123" } });
    expect(res.status).toBe(200);
    expect(res.json.tenant.id).toBe(second.tenant.id);
  });

  it("switches to another workspace and refuses one the person is not in", async () => {
    const email = `owner-${Date.now()}@test.dev`;
    const first = await makeWorkspace({ email, password: "password123" });
    const second = await makeWorkspace({ email, password: "password123" });
    const elsewhere = await makeWorkspace({ email: `other-${Date.now()}@test.dev`, password: "password123" });

    const login = await call("/api/v1/auth/login", { method: "POST", body: { email, password: "password123" } });
    const token = cookieToken(login.headers);
    expect(token).not.toBe("");

    const switched = await call("/api/v1/auth/switch", { method: "POST", staff: token, body: { tenantId: second.tenant.id } });
    expect(switched.status).toBe(200);

    const me = await call("/api/v1/auth/me", { staff: cookieToken(switched.headers) });
    expect(me.json.tenant.id).toBe(second.tenant.id);
    expect(me.json.workspaces.map((w: { id: number }) => w.id)).toEqual([first.tenant.id, second.tenant.id]);

    const denied = await call("/api/v1/auth/switch", { method: "POST", staff: token, body: { tenantId: elsewhere.tenant.id } });
    expect(denied.status).toBe(403);
  });

  it("adds another workspace that the person owns", async () => {
    const email = `owner-${Date.now()}@test.dev`;
    const first = await makeWorkspace({ email, password: "password123" });
    const login = await call("/api/v1/auth/login", { method: "POST", body: { email, password: "password123" } });
    const token = cookieToken(login.headers);
    const slug = `second-agency-${++seq}`;

    const created = await call("/api/v1/auth/workspaces", {
      method: "POST",
      staff: token,
      body: { companyName: "Second agency", slug },
    });
    expect(created.status).toBe(201);

    const added = await db().query.tenants.findFirst({ where: eq(schema.tenants.slug, slug) });
    expect(added).toBeTruthy();

    const me = await call("/api/v1/auth/me", { staff: cookieToken(created.headers) });
    expect(me.json.tenant.companyName).toBe("Second agency");
    expect(me.json.tenant.slug).toBe(slug);
    expect(me.json.staff.role).toBe("OWNER");
    expect(me.json.workspaces).toHaveLength(2);
    expect(me.json.workspaces[0].id).toBe(first.tenant.id);
  });

  it("keeps one free trial per person: a second workspace goes straight to a plan", async () => {
    const email = `owner-${Date.now()}@test.dev`;
    const first = await makeWorkspace({
      email,
      password: "password123",
      name: "First agency",
      plan: "STARTER",
      billingMode: "SELF_SERVE",
      trialUsedAt: new Date(),
      trialEmail: email,
    });
    const login = await call("/api/v1/auth/login", { method: "POST", body: { email, password: "password123" } });
    const token = cookieToken(login.headers);

    const created = await call("/api/v1/auth/workspaces", {
      method: "POST",
      staff: token,
      body: { companyName: "Second agency", slug: `second-agency-${++seq}` },
    });
    const me = await call("/api/v1/auth/me", { staff: cookieToken(created.headers) });
    expect(me.json.access.trialAvailable).toBe(false);
    expect(me.json.access.locked).toBe(true);

    // The workspace that used the trial is unaffected.
    const firstSession = await call("/api/v1/auth/me", { staff: token });
    expect(firstSession.json.access.trialAvailable).toBe(false);
    expect(firstSession.json.tenant.id).toBe(first.tenant.id);
  });
});

describe("passwords belong to the person, not to the workspace", () => {
  it("an invited person who already signs in keeps their own password", async () => {
    const email = `member-${Date.now()}@test.dev`;
    const theirs = await makeWorkspace({ email: `owner-${Date.now()}@test.dev`, password: "password123" });
    const member = await makeMember(theirs.tenant.id, email, "password123");
    const mine = await makeWorkspace({ email: `boss-${Date.now()}@test.dev`, password: "password123" });

    const boss = await call("/api/v1/auth/login", { method: "POST", body: { email: mine.tenant.email, password: "password123" } });
    const token = cookieToken(boss.headers);

    const invited = await call("/api/v1/tenant/staff", {
      method: "POST",
      staff: token,
      body: { name: "Teammate", email, password: "a-different-password" },
    });
    expect(invited.status).toBe(201);
    expect(invited.json.existingAccount).toBe(true);

    // The membership in the new workspace keeps the password the person already has.
    const added = await db().query.tenantStaff.findFirst({
      where: and(eq(schema.tenantStaff.tenantId, mine.tenant.id), eq(schema.tenantStaff.email, email)),
    });
    expect(added?.password).toBe(member.password);
  });

  it("an owner cannot set the password of someone who owns another workspace", async () => {
    const email = `owner-${Date.now()}@test.dev`;
    const mine = await makeWorkspace({ email: `boss-${Date.now()}@test.dev`, password: "password123" });
    const member = await makeMember(mine.tenant.id, email, "password123", "MANAGER");
    await makeWorkspace({ email, password: "password123", name: "Their own agency" });

    const boss = await call("/api/v1/auth/login", { method: "POST", body: { email: mine.tenant.email, password: "password123" } });
    const token = cookieToken(boss.headers);

    const res = await call(`/api/v1/tenant/staff/${member.id}`, {
      method: "PATCH",
      staff: token,
      body: { password: "taken-over" },
    });
    expect(res.status).toBe(409);
    expect(res.json.code).toBe("PASSWORD_OWNED");
  });

  it("a password reset changes every workspace the person can sign in to", async () => {
    const email = `owner-${Date.now()}@test.dev`;
    const first = await makeWorkspace({ email, password: "password123" });
    const second = await makeWorkspace({ email, password: "password123" });

    const { token } = await issueStaffToken(db(), first.owner.id, "RESET");
    const reset = await call("/api/v1/auth/reset-password", { method: "POST", body: { token, password: "a-new-password" } });
    expect(reset.status).toBe(200);

    const res = await call("/api/v1/auth/login", { method: "POST", body: { email, password: "a-new-password" } });
    expect(res.status).toBe(200);
    expect(res.json.workspaces.map((w: { id: number }) => w.id)).toEqual([first.tenant.id, second.tenant.id]);
  });
});
