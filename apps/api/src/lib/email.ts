type SendEmailInput = {
  apiKey: string;
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
};

export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: input.from,
        to: Array.isArray(input.to) ? input.to : [input.to],
        subject: input.subject,
        html: input.html,
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
      }),
    });
    if (!res.ok) {
      console.error("Resend error", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("Resend fetch failed", err);
    return false;
  }
}

export function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function layout(title: string, body: string) {
  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;color:#0f172a;max-width:560px;margin:0 auto;padding:24px;">
  <h2 style="font-size:18px;margin:0 0 16px;">${title}</h2>
  ${body}
  <p style="color:#64748b;font-size:12px;margin-top:32px;">Sent by Wepilo</p>
  </body></html>`;
}

export type BatchMessage = {
  to: string;
  subject: string;
  html: string;
  headers?: Record<string, string>;
};

/**
 * Sends many separate emails with Resend's batch endpoint (100 per call), so a long list
 * stays within a Worker's subrequest limit. Returns how many were accepted.
 */
export async function sendEmailBatch(
  apiKey: string,
  from: string,
  messages: BatchMessage[],
  replyTo?: string,
): Promise<number> {
  let accepted = 0;
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    try {
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(
          chunk.map((m) => ({ from, to: [m.to], subject: m.subject, html: m.html, ...(replyTo ? { reply_to: replyTo } : {}), ...(m.headers ? { headers: m.headers } : {}) })),
        ),
      });
      if (res.ok) accepted += chunk.length;
      else console.error("Resend batch error", res.status, await res.text());
    } catch (err) {
      console.error("Resend batch failed", err);
    }
  }
  return accepted;
}
