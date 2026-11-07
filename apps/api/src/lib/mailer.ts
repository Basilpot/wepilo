import { eq } from "drizzle-orm";
import type { Env } from "@/env";
import type { Db } from "@/db";
import * as schema from "@/db/schema";
import { sendEmail, sendEmailBatch, type BatchMessage } from "@/lib/email";
import { decryptSecret } from "@/lib/secrets";

type Sender = { apiKey: string; from: string; replyTo?: string; custom: boolean };

function formatFrom(name: string | null, email: string) {
  return name ? `${name.replace(/[<>"]/g, "")} <${email}>` : email;
}

/**
 * Who mail for this agency goes out as. A verified, enabled agency Resend account is used
 * as is; otherwise the platform sender is used with the agency's contact address as Reply-To,
 * so a traveller's reply still reaches the agency.
 */
export async function senderFor(env: Env, db: Db, tenantId: number): Promise<Sender> {
  const [config, tenant] = await Promise.all([
    db.query.tenantEmailConfig.findFirst({ where: eq(schema.tenantEmailConfig.tenantId, tenantId) }),
    db.query.tenants.findFirst({ where: eq(schema.tenants.id, tenantId), columns: { email: true, companyName: true } }),
  ]);
  if (config?.enabled && config.verifiedAt && config.resendApiKeyEnc && config.fromEmail) {
    const apiKey = await decryptSecret(env, config.resendApiKeyEnc);
    if (apiKey) {
      return {
        apiKey,
        from: formatFrom(config.fromName ?? tenant?.companyName ?? null, config.fromEmail),
        replyTo: config.replyTo ?? undefined,
        custom: true,
      };
    }
  }
  return {
    apiKey: env.RESEND_API_KEY,
    from: tenant?.companyName ? formatFrom(tenant.companyName, extractEmail(env.PLATFORM_EMAIL_FROM)) : env.PLATFORM_EMAIL_FROM,
    replyTo: config?.replyTo ?? tenant?.email,
    custom: false,
  };
}

function extractEmail(from: string) {
  return from.match(/<([^>]+)>/)?.[1] ?? from;
}

/** Where the agency wants inquiry and booking alerts delivered. */
export async function alertRecipients(db: Db, tenantId: number): Promise<string[]> {
  const [config, tenant] = await Promise.all([
    db.query.tenantEmailConfig.findFirst({ where: eq(schema.tenantEmailConfig.tenantId, tenantId), columns: { inquiryRecipients: true } }),
    db.query.tenants.findFirst({ where: eq(schema.tenants.id, tenantId), columns: { email: true } }),
  ]);
  const custom = config?.inquiryRecipients?.filter(Boolean) ?? [];
  return custom.length ? custom : tenant?.email ? [tenant.email] : [];
}

/**
 * Sends one email as the agency. If the agency's own account fails, falls back to the platform
 * sender once so a revoked key doesn't silently swallow booking alerts.
 */
export async function sendAsTenant(
  env: Env,
  db: Db,
  tenantId: number,
  mail: { to: string | string[]; subject: string; html: string; replyTo?: string },
) {
  const sender = await senderFor(env, db, tenantId);
  const attempt = (s: Sender) =>
    sendEmail({ apiKey: s.apiKey, from: s.from, to: mail.to, subject: mail.subject, html: mail.html, replyTo: mail.replyTo ?? s.replyTo });
  if (!sender.apiKey) return false;
  if (await attempt(sender)) return true;
  if (sender.custom) {
    await db
      .update(schema.tenantEmailConfig)
      .set({ lastError: "Your Resend account rejected a message, so Wepilo's address was used instead.", updatedAt: new Date() })
      .where(eq(schema.tenantEmailConfig.tenantId, tenantId));
    return sendEmail({
      apiKey: env.RESEND_API_KEY,
      from: env.PLATFORM_EMAIL_FROM,
      to: mail.to,
      subject: mail.subject,
      html: mail.html,
      replyTo: mail.replyTo ?? sender.replyTo,
    });
  }
  return false;
}

export async function sendBatchAsTenant(env: Env, db: Db, tenantId: number, messages: BatchMessage[]) {
  const sender = await senderFor(env, db, tenantId);
  if (!sender.apiKey) return 0;
  return sendEmailBatch(sender.apiKey, sender.from, messages, sender.replyTo);
}
