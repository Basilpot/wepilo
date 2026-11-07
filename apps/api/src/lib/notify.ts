import type { Context } from "hono";
import type { Env } from "@/env";
import type { Db } from "@/db";
import type { AppEnv } from "@/types";
import { layout, escapeHtml } from "@/lib/email";
import { alertRecipients, sendAsTenant } from "@/lib/mailer";

function row(label: string, value: string | null | undefined) {
  if (!value) return "";
  return `<tr><td style="padding:4px 12px 4px 0;color:#64748b;vertical-align:top">${escapeHtml(label)}</td><td style="padding:4px 0">${escapeHtml(value).replace(/\n/g, "<br>")}</td></tr>`;
}

export type OwnerAlert = {
  subject: string;
  heading: string;
  fields: Array<[string, string | null | undefined]>;
  replyTo?: string;
  /** Dashboard path the "Open" link goes to. */
  path: string;
};

/** Emails the agency's alert recipients. Never throws: a mail failure must not undo the booking or payment. */
export async function sendOwnerAlert(env: Env, db: Db, tenantId: number, opts: OwnerAlert) {
  try {
    const to = await alertRecipients(db, tenantId);
    if (!to.length) return;
    await sendAsTenant(env, db, tenantId, {
      to,
      subject: opts.subject,
      replyTo: opts.replyTo,
      html: layout(
        escapeHtml(opts.heading),
        `<table style="border-collapse:collapse;font-size:14px">${opts.fields.map(([l, v]) => row(l, v)).join("")}</table>
         <p style="margin-top:20px"><a href="${env.DASHBOARD_URL}${opts.path}">Open in your dashboard</a></p>`,
      ),
    });
  } catch (err) {
    console.error("owner alert failed", err);
  }
}

/** Same, but after the response is sent. */
export function notifyOwner(c: Context<AppEnv>, opts: OwnerAlert) {
  const task = sendOwnerAlert(c.env, c.get("db"), c.get("tenantId"), opts);
  try {
    c.executionCtx.waitUntil(task);
  } catch {
    // No execution context (tests): the task still runs.
  }
}
