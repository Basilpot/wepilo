import { describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { isPlatformHost, normalizeDomain } from "@/lib/domain";
import { call, db, makeTenant, makeTrip } from "./helpers";

const realFetch = globalThis.fetch;
function mockDns(records: Record<string, string[]>) {
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const u = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (u.startsWith("https://cloudflare-dns.com/")) {
      const name = new URL(u).searchParams.get("name")!;
      return new Response(JSON.stringify({ Answer: (records[name] ?? []).map((v) => ({ type: 16, data: `"${v}"` })) }));
    }
    return realFetch(input, init);
  });
  return () => vi.stubGlobal("fetch", realFetch);
}

describe("domain handling", () => {
  it("normalises pasted addresses and rejects junk", () => {
    expect(normalizeDomain("https://WWW.Agency.com/trips?x=1")).toBe("www.agency.com");
    expect(normalizeDomain("agency.com:8080")).toBe("agency.com");
    for (const bad of ["localhost", "192.168.1.10", "-bad-.com", "a b.com", "agency", ""]) expect(normalizeDomain(bad)).toBeNull();
  });
  it("blocks Wepilo's own hosts", () => {
    const e = { DASHBOARD_URL: "https://wepilo.basilpot.com", API_BASE_URL: "https://wepiloapi.basilpot.com", SITE_URL: "https://wepilo.basilpot.com" };
    expect(isPlatformHost(e, "wepilo.basilpot.com")).toBe(true);
    expect(isPlatformHost(e, "x.wepilo.basilpot.com")).toBe(true);
    expect(isPlatformHost(e, "agency.com")).toBe(false);
  });
});

describe("custom domains", () => {
  it("verifies by DNS record, then identifies the agency from its origin", async () => {
    const { tenant, token } = await makeTenant();
    const domain = `www.agency-${tenant.id}.test`;
    const set = await call("/api/v1/tenant/domain", { method: "PUT", staff: token, body: { domain: `https://${domain}/` } });
    expect(set.status).toBe(200);
    expect(set.json).toMatchObject({ domain, verified: false });
    const { record } = set.json;
    expect(record.name).toBe(`_wepilo-verify.${domain}`);

    // Unverified: the origin identifies nobody.
    const before = await call("/api/v1/site", { headers: { origin: `https://${domain}` } });
    expect(before.status).toBe(400);

    let restore = mockDns({});
    const missing = await call("/api/v1/tenant/domain/verify", { method: "POST", staff: token, body: {} });
    restore();
    expect(missing.status).toBe(422);

    restore = mockDns({ [record.name]: [record.value] });
    const ok = await call("/api/v1/tenant/domain/verify", { method: "POST", staff: token, body: {} });
    restore();
    expect(ok.json.verified).toBe(true);

    for (const origin of [`https://${domain}`, `https://${domain.replace("www.", "")}`]) {
      const res = await call("/api/v1/site", { headers: { origin } });
      expect(res.status).toBe(200);
      expect(res.json.company.name).toBe(tenant.companyName);
    }
    // A different domain still resolves nothing.
    expect((await call("/api/v1/site", { headers: { origin: "https://other.test" } })).status).toBe(400);
  });

  it("refuses a domain another workspace already holds, and platform hosts", async () => {
    const a = await makeTenant();
    const b = await makeTenant();
    const domain = `shared-${a.tenant.id}.test`;
    expect((await call("/api/v1/tenant/domain", { method: "PUT", staff: a.token, body: { domain } })).status).toBe(200);
    const taken = await call("/api/v1/tenant/domain", { method: "PUT", staff: b.token, body: { domain } });
    expect(taken.status).toBe(409);
    expect(taken.json.code).toBe("DOMAIN_TAKEN");
    expect((await call("/api/v1/tenant/domain", { method: "PUT", staff: b.token, body: { domain: "app.localhost" } })).status).toBe(400);
  });

  it("changing the domain resets verification", async () => {
    const { tenant, token } = await makeTenant();
    await call("/api/v1/tenant/domain", { method: "PUT", staff: token, body: { domain: `one-${tenant.id}.test` } });
    await db().update(schema.tenants).set({ customDomainVerifiedAt: new Date() }).where(eq(schema.tenants.id, tenant.id));
    const next = await call("/api/v1/tenant/domain", { method: "PUT", staff: token, body: { domain: `two-${tenant.id}.test` } });
    expect(next.json.verified).toBe(false);
  });
});

describe("onboarding checklist", () => {
  it("reflects what the workspace really has", async () => {
    const { tenant, token } = await makeTenant();
    const before = await call("/api/v1/tenant/onboarding", { staff: token });
    const done = (r: typeof before) => Object.fromEntries((r.json.steps as Array<{ key: string; done: boolean }>).map((s) => [s.key, s.done]));
    expect(done(before)).toMatchObject({ profile: false, trip: false, departure: false, payments: false, team: false });

    await makeTrip(tenant.id);
    await call("/api/v1/payments/settings", { method: "PUT", staff: token, body: { bankEnabled: true, bankInstructions: "IBAN 1" } });
    await call("/api/v1/site/config", { method: "PUT", staff: token, body: (await import("@/lib/site")).defaultSiteConfig() });
    const after = await call("/api/v1/tenant/onboarding", { staff: token });
    expect(done(after)).toMatchObject({ trip: true, departure: true, payments: true, homepage: true });
    expect(after.json.completed).toBeGreaterThan(before.json.completed);
  });
});

describe("media", () => {
  async function upload(token: string, name: string, type: string, bytes: number) {
    const form = new FormData();
    form.set("file", new File([new Uint8Array(bytes)], name, { type }));
    const { app } = await import("@/app");
    const { createExecutionContext, waitOnExecutionContext } = await import("cloudflare:test");
    const ctx = createExecutionContext();
    const res = await app.fetch(new Request("http://api.test/api/v1/media/upload", { method: "POST", body: form, headers: { cookie: `wepilo_staff_token=${token}` } }), env, ctx);
    await waitOnExecutionContext(ctx);
    return { status: res.status, json: (await res.json()) as any };
  }

  it("accepts short video, rejects oversized video, and filters pickers by kind", async () => {
    const { token } = await makeTenant();
    const clip = await upload(token, "clip.mp4", "video/mp4", 2048);
    expect(clip.status).toBe(201);
    expect((await upload(token, "big.mp4", "video/mp4", 26 * 1024 * 1024)).status).toBe(413);
    expect((await upload(token, "x.exe", "application/x-msdownload", 10)).status).toBe(415);
    await upload(token, "pic.png", "image/png", 100);
    const videos = await call("/api/v1/media?type=video", { staff: token });
    expect(videos.json.data.map((m: { filename: string }) => m.filename)).toEqual(["clip.mp4"]);
    const images = await call("/api/v1/media?type=image", { staff: token });
    expect(images.json.data.map((m: { filename: string }) => m.filename)).toEqual(["pic.png"]);
  });

  it("serves byte ranges so video can seek, and never serves private prefixes", async () => {
    const { token } = await makeTenant();
    const clip = await upload(token, "seek.mp4", "video/mp4", 1000);
    const path = new URL(clip.json.media.url).pathname;
    const full = await call(path);
    expect(full.status).toBe(200);
    const part = await call(path, { headers: { range: "bytes=100-199" } });
    expect(part.status).toBe(206);
    expect(part.headers.get("content-range")).toBe("bytes 100-199/1000");
    await env.MEDIA.put("support/1/1/secret.txt", "secret");
    expect((await call("/media/file/support/1/1/secret.txt")).status).toBe(404);
  });
});

describe("support attachments", () => {
  async function ticket(token: string) {
    return (await call("/api/v1/support", { staff: token, body: { category: "Billing", subject: "Help", message: "Please" } })).json.ticket.id as number;
  }
  async function attach(token: string, id: number, file: File) {
    const form = new FormData();
    form.set("file", file);
    const { app } = await import("@/app");
    const { createExecutionContext, waitOnExecutionContext } = await import("cloudflare:test");
    const ctx = createExecutionContext();
    const res = await app.fetch(new Request(`http://api.test/api/v1/support/${id}/attachments`, { method: "POST", body: form, headers: { cookie: `wepilo_staff_token=${token}` } }), env, ctx);
    await waitOnExecutionContext(ctx);
    return { status: res.status, json: (await res.json()) as any };
  }

  it("stores files privately, downloads them as attachments and hides them from others", async () => {
    const a = await makeTenant();
    const b = await makeTenant();
    const id = await ticket(a.token);
    const up = await attach(a.token, id, new File(["hello log"], "error.txt", { type: "text/plain" }));
    expect(up.status).toBe(201);
    expect(JSON.stringify(up.json)).not.toContain("support/");

    const dl = await call(`/api/v1/support/${id}/attachments/${up.json.attachment.id}`, { staff: a.token });
    expect(dl.status).toBe(200);
    expect(dl.text).toBe("hello log");
    expect(dl.headers.get("content-disposition")).toContain("attachment");
    expect(dl.headers.get("x-content-type-options")).toBe("nosniff");

    expect((await call(`/api/v1/support/${id}/attachments`, { staff: b.token })).status).toBe(404);
    expect((await call(`/api/v1/support/${id}/attachments/${up.json.attachment.id}`, { staff: b.token })).status).toBe(404);
    expect((await attach(a.token, id, new File(["x"], "evil.html", { type: "text/html" }))).status).toBe(415);
    expect((await attach(a.token, id, new File([new Uint8Array(6 * 1024 * 1024)], "big.pdf", { type: "application/pdf" }))).status).toBe(413);
  });
});
