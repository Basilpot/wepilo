import { describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:test";
import * as schema from "@/db/schema";
import { encryptSecret, decryptSecret, maskSecret } from "@/lib/secrets";
import { alertRecipients, senderFor } from "@/lib/mailer";
import { call, db, makeTenant } from "./helpers";

describe("secrets", () => {
  it("round-trips and refuses tampered or foreign values", async () => {
    const enc = await encryptSecret(env, "re_live_abcdefgh1234");
    expect(enc).not.toContain("abcdefgh");
    expect(await decryptSecret(env, enc)).toBe("re_live_abcdefgh1234");
    expect(await decryptSecret({ JWT_SECRET: "another-secret-another-secret-xx" }, enc)).toBeNull();
    expect(await decryptSecret(env, enc.slice(0, -3) + "AAA")).toBeNull();
    expect(maskSecret("re_live_abcdefgh1234")).toBe("re_…1234");
  });
});

describe("email settings", () => {
  const url = "/api/v1/tenant/email-settings";

  it("never returns the API key and needs a passing test before using it", async () => {
    const { tenant, token } = await makeTenant();
    const saved = await call(url, {
      method: "PUT",
      staff: token,
      body: { apiKey: "re_secretsecret123", fromEmail: "hello@agency.test", fromName: "Agency", inquiryRecipients: ["Sales@Agency.test"] },
    });
    expect(saved.status).toBe(200);
    expect(saved.text).not.toContain("secretsecret");
    expect(saved.json.config.apiKeyHint).toBe("re_…t123");
    expect(saved.json.config.inquiryRecipients).toEqual(["sales@agency.test"]);
    expect(saved.json.config.verifiedAt).toBeNull();

    // Unverified: mail still goes out through the platform sender.
    expect((await senderFor(env, db(), tenant.id)).custom).toBe(false);
    expect(await alertRecipients(db(), tenant.id)).toEqual(["sales@agency.test"]);
  });

  it("uses the agency's account after a successful test send, and records failures", async () => {
    const { tenant, token } = await makeTenant();
    await call(url, { method: "PUT", staff: token, body: { apiKey: "re_secretsecret123", fromEmail: "hello@agency.test" } });

    const ok = await call(`${url}/test`, { method: "POST", staff: token, body: {} });
    expect(ok.status).toBe(200);
    expect(ok.json.config.verifiedAt).not.toBeNull();
    const sender = await senderFor(env, db(), tenant.id);
    expect(sender.custom).toBe(true);
    expect(sender.apiKey).toBe("re_secretsecret123");
    expect(sender.from).toContain("hello@agency.test");

    // Changing the sender address drops verification again.
    const changed = await call(url, { method: "PUT", staff: token, body: { fromEmail: "other@agency.test" } });
    expect(changed.json.config.verifiedAt).toBeNull();
    expect((await senderFor(env, db(), tenant.id)).custom).toBe(false);
  });

  it("surfaces Resend's error on a failed test", async () => {
    const { token } = await makeTenant();
    await call(url, { method: "PUT", staff: token, body: { apiKey: "re_badbadbad123", fromEmail: "hello@unverified.test" } });
    const realFetch = globalThis.fetch;
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const u = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (u.startsWith("https://api.resend.com/")) {
        return new Response(JSON.stringify({ message: "The unverified.test domain is not verified." }), { status: 403 });
      }
      return realFetch(input, init);
    });
    try {
      const res = await call(`${url}/test`, { method: "POST", staff: token, body: {} });
      expect(res.status).toBe(422);
      expect(res.json.error).toContain("not verified");
    } finally {
      vi.stubGlobal("fetch", realFetch);
    }
  });

  it("needs a sender address with a key, and only owners/admins may change it", async () => {
    const { tenant, token } = await makeTenant();
    const bad = await call(url, { method: "PUT", staff: token, body: { apiKey: "re_secretsecret123" } });
    expect(bad.status).toBe(400);

    const [editor] = await db()
      .insert(schema.tenantStaff)
      .values({ tenantId: tenant.id, name: "Ed", email: "ed@agency.test", password: "x", role: "EDITOR" })
      .returning();
    const { signToken } = await import("@/lib/auth");
    const editorToken = await signToken(env, { kind: "staff", staffId: editor.id, tenantId: tenant.id, role: "EDITOR" });
    expect((await call(url, { staff: editorToken })).status).toBe(403);
  });

  it("lets alert recipients be set without connecting Resend", async () => {
    const { tenant, token } = await makeTenant();
    const res = await call(url, { method: "PUT", staff: token, body: { inquiryRecipients: ["a@agency.test", "b@agency.test"] } });
    expect(res.status).toBe(200);
    expect(res.json.config.hasApiKey).toBe(false);
    expect(await alertRecipients(db(), tenant.id)).toEqual(["a@agency.test", "b@agency.test"]);
  });
});

describe("alerts use the agency's recipients", () => {
  it("sends the inquiry alert to the configured recipients with the traveller as reply-to", async () => {
    const { tenant, token } = await makeTenant();
    await call("/api/v1/tenant/email-settings", { method: "PUT", staff: token, body: { inquiryRecipients: ["sales@agency.test"] } });
    const sent: Array<{ to: string[]; reply_to?: string; subject: string }> = [];
    const realFetch = globalThis.fetch;
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const u = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (u.startsWith("https://api.resend.com/")) {
        sent.push(JSON.parse(String(init?.body)));
        return new Response("{}", { status: 200 });
      }
      return realFetch(input, init);
    });
    try {
      // Alerts need a platform key to send through; supply one for this assertion.
      (env as { RESEND_API_KEY: string }).RESEND_API_KEY = "re_platform_test";
      const res = await call("/api/v1/inquiries", {
        slug: tenant.slug,
        body: { name: "Asha", email: "asha@example.com", message: "Hi there" },
      });
      expect(res.status).toBe(201);
      expect(sent).toHaveLength(1);
      expect(sent[0].to).toEqual(["sales@agency.test"]);
      expect(sent[0].reply_to).toBe("asha@example.com");
    } finally {
      vi.stubGlobal("fetch", realFetch);
    }
  });
});
