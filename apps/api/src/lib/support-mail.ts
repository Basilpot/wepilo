import { eq } from "drizzle-orm";
import type { Env } from "@/env";
import type { Db } from "@/db";
import * as schema from "@/db/schema";
import { escapeHtml, layout, sendEmail } from "@/lib/email";

/**
 * Support mail always goes from Wepilo, never from the agency: Wepilo is the one answering.
 * Nothing here throws. A mail failure must not undo the ticket or the reply.
 */

type TicketRow = {
  id: number;
  subject: string;
  message: string;
  category: string;
  status: string;
  priority: string;
  creatorName: string | null;
};

async function loadTicket(db: Db, ticketId: number) {
  return db.query.supportTickets.findFirst({
    where: eq(schema.supportTickets.id, ticketId),
    with: {
      creator: { columns: { name: true, email: true } },
      tenant: { columns: { companyName: true, slug: true, email: true } },
    },
  });
}

/** A new request, sent to the Wepilo team. */
export async function notifyPlatformOfTicket(env: Env, db: Db, ticketId: number) {
  try {
    const ticket = await loadTicket(db, ticketId);
    if (!ticket) return;
    const workspace = ticket.tenant?.companyName ?? ticket.tenant?.slug ?? "A workspace";
    await sendEmail({
      apiKey: env.RESEND_API_KEY,
      from: env.PLATFORM_EMAIL_FROM,
      to: env.PLATFORM_SUPPORT_EMAIL,
      replyTo: ticket.creator?.email,
      subject: `Support request: ${ticket.subject}`,
      html: layout(
        `New support request from ${escapeHtml(workspace)}`,
        `<p style="color:#475569;margin:0 0 16px">${escapeHtml(ticket.category)} · ${escapeHtml(ticket.creatorName ?? ticket.creator?.name ?? "Someone")} · ${escapeHtml(ticket.tenant?.email ?? "")}</p>
         <p style="white-space:pre-wrap">${escapeHtml(ticket.message)}</p>
         <p style="margin:24px 0 0"><a href="${env.DASHBOARD_URL}/admin/support/${ticket.id}">Open it in the Wepilo console</a></p>`,
      ),
    });
  } catch (err) {
    console.error("support ticket notification failed", err);
  }
}

/** The agency replied, so the Wepilo team hears about it. */
export async function notifyPlatformOfReply(env: Env, db: Db, ticketId: number, reply: { authorName: string | null; message: string }) {
  try {
    const ticket = await loadTicket(db, ticketId);
    if (!ticket) return;
    await sendEmail({
      apiKey: env.RESEND_API_KEY,
      from: env.PLATFORM_EMAIL_FROM,
      to: env.PLATFORM_SUPPORT_EMAIL,
      replyTo: ticket.creator?.email,
      subject: `Reply on: ${ticket.subject}`,
      html: layout(
        `${escapeHtml(reply.authorName ?? "The agency")} replied to a support request`,
        `<p style="color:#475569;margin:0 0 16px">${escapeHtml(ticket.subject)} · ${escapeHtml(ticket.tenant?.companyName ?? "")}</p>
         <p style="white-space:pre-wrap">${escapeHtml(reply.message)}</p>
         <p style="margin:24px 0 0"><a href="${env.DASHBOARD_URL}/admin/support/${ticket.id}">Open it in the Wepilo console</a></p>`,
      ),
    });
  } catch (err) {
    console.error("support reply notification failed", err);
  }
}

/** Wepilo answered, so the agency hears about it. */
export async function notifyTenantOfReply(env: Env, db: Db, ticketId: number, reply: { authorName: string; message: string }) {
  try {
    const ticket = await loadTicket(db, ticketId);
    if (!ticket) return;
    // The person who wrote it, or the workspace owner if that login is gone.
    const to = ticket.creator?.email ?? ticket.tenant?.email;
    if (!to) return;
    await sendEmail({
      apiKey: env.RESEND_API_KEY,
      from: env.PLATFORM_EMAIL_FROM,
      to,
      subject: `Wepilo replied: ${ticket.subject}`,
      html: layout(
        `${escapeHtml(reply.authorName)} from Wepilo replied to your support request`,
        `<p style="color:#475569;margin:0 0 16px">${escapeHtml(ticket.subject)}</p>
         <p style="white-space:pre-wrap">${escapeHtml(reply.message)}</p>
         <p style="margin:24px 0 0"><a href="${env.DASHBOARD_URL}/support/${ticket.id}">Read the whole thread</a></p>`,
      ),
    });
  } catch (err) {
    console.error("support tenant notification failed", err);
  }
}
