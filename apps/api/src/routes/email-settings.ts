import { Hono } from "hono";
import { z } from "zod";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AppEnv } from "@/types";
import { ApiError } from "@/lib/http";
import { requireStaff, requireTenant } from "@/middleware/context";
import { encryptSecret, decryptSecret, maskSecret } from "@/lib/secrets";
import { layout, escapeHtml } from "@/lib/email";
import { enforce, LIMITS } from "@/lib/rate-limit";

const bodySchema = z.object({
  /** Omit to keep the stored key. */
  apiKey: z.string().trim().min(8).max(200).optional(),
  fromEmail: z.string().trim().email().max(200).nullable().optional(),
  fromName: z.string().trim().max(120).nullable().optional(),
  replyTo: z.string().trim().email().max(200).nullable().optional(),
  inquiryRecipients: z.array(z.string().trim().email().max(200)).max(10).default([]),
  enabled: z.boolean().default(true),
});

async function view(c: { get: (k: "db") => import("@/db").Db; env: AppEnv["Bindings"] }, tenantId: number) {
  const db = c.get("db");
  const [config, tenant] = await Promise.all([
    db.query.tenantEmailConfig.findFirst({ where: eq(schema.tenantEmailConfig.tenantId, tenantId) }),
    db.query.tenants.findFirst({ where: eq(schema.tenants.id, tenantId), columns: { email: true } }),
  ]);
  const key = config?.resendApiKeyEnc ? await decryptSecret(c.env, config.resendApiKeyEnc) : null;
  return {
    config: config
      ? {
          fromEmail: config.fromEmail,
          fromName: config.fromName,
          replyTo: config.replyTo,
          inquiryRecipients: config.inquiryRecipients ?? [],
          enabled: config.enabled,
          verifiedAt: config.verifiedAt,
          lastError: config.lastError,
          hasApiKey: Boolean(config.resendApiKeyEnc),
          apiKeyHint: key ? maskSecret(key) : null,
        }
      : null,
    ownerEmail: tenant?.email ?? null,
  };
}

export const emailSettingsRoutes = new Hono<AppEnv>()
  .use("*", requireStaff("OWNER", "ADMIN"), requireTenant())
  .get("/", async (c) => c.json(await view(c, c.get("tenantId"))))
  .put("/", async (c) => {
    const body = bodySchema.parse(await c.req.json());
    const db = c.get("db");
    const tenantId = c.get("tenantId");
    const existing = await db.query.tenantEmailConfig.findFirst({
      where: eq(schema.tenantEmailConfig.tenantId, tenantId),
    });

    const nextKeyEnc = body.apiKey ? await encryptSecret(c.env, body.apiKey) : (existing?.resendApiKeyEnc ?? null);
    const fromEmail = body.fromEmail === undefined ? (existing?.fromEmail ?? null) : body.fromEmail || null;
    if (nextKeyEnc && !fromEmail) {
      throw new ApiError(400, "fromEmail: required when you connect your own Resend account", "VALIDATION");
    }
    // A new key or sender address has to pass a test send again before it's used.
    const credentialsChanged = Boolean(body.apiKey) || fromEmail !== (existing?.fromEmail ?? null);
    const values = {
      resendApiKeyEnc: nextKeyEnc,
      fromEmail,
      fromName: body.fromName === undefined ? (existing?.fromName ?? null) : body.fromName || null,
      replyTo: body.replyTo === undefined ? (existing?.replyTo ?? null) : body.replyTo || null,
      inquiryRecipients: [...new Set(body.inquiryRecipients.map((e) => e.toLowerCase()))],
      enabled: body.enabled,
      verifiedAt: credentialsChanged ? null : (existing?.verifiedAt ?? null),
      lastError: credentialsChanged ? null : (existing?.lastError ?? null),
      updatedAt: new Date(),
    };
    await db
      .insert(schema.tenantEmailConfig)
      .values({ tenantId, ...values })
      .onConflictDoUpdate({ target: schema.tenantEmailConfig.tenantId, set: values });
    return c.json(await view(c, tenantId));
  })
  // Sends a real message to the signed-in person through the agency's Resend account.
  .post("/test", async (c) => {
    const db = c.get("db");
    const tenantId = c.get("tenantId");
    const staff = c.get("staff")!;
    await enforce(db, { name: "email-test", max: 6, windowSeconds: 60 * 60 }, String(tenantId));
    const config = await db.query.tenantEmailConfig.findFirst({
      where: eq(schema.tenantEmailConfig.tenantId, tenantId),
    });
    if (!config?.resendApiKeyEnc || !config.fromEmail) {
      throw new ApiError(400, "Save your Resend API key and sender address first.", "NOT_CONFIGURED");
    }
    const apiKey = await decryptSecret(c.env, config.resendApiKeyEnc);
    if (!apiKey) throw new ApiError(409, "The saved key can't be read any more. Enter it again.", "KEY_UNREADABLE");

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: config.fromName ? `${config.fromName.replace(/[<>"]/g, "")} <${config.fromEmail}>` : config.fromEmail,
        to: [staff.email],
        subject: "Your Wepilo email settings work",
        html: layout(
          "Email settings verified",
          `<p>Hi ${escapeHtml(staff.name)}, this message was sent through your own Resend account. Bookings, inquiries and newsletters will now go out from <strong>${escapeHtml(config.fromEmail)}</strong>.</p>`,
        ),
      }),
    }).catch(() => null);

    if (!res || !res.ok) {
      const detail = res ? await res.json().catch(() => null) : null;
      const message =
        (detail as { message?: string } | null)?.message ??
        (res ? `Resend answered ${res.status}.` : "Couldn't reach Resend. Try again in a moment.");
      await db
        .update(schema.tenantEmailConfig)
        .set({ verifiedAt: null, lastError: message, updatedAt: new Date() })
        .where(eq(schema.tenantEmailConfig.tenantId, tenantId));
      throw new ApiError(422, message, "EMAIL_TEST_FAILED");
    }
    await db
      .update(schema.tenantEmailConfig)
      .set({ verifiedAt: new Date(), lastError: null, updatedAt: new Date() })
      .where(eq(schema.tenantEmailConfig.tenantId, tenantId));
    return c.json({ ...(await view(c, tenantId)), sentTo: staff.email });
  })
  .delete("/", async (c) => {
    await c.get("db").delete(schema.tenantEmailConfig).where(eq(schema.tenantEmailConfig.tenantId, c.get("tenantId")));
    return c.json({ ok: true });
  });
