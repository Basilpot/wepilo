type SendEmailInput = {
  apiKey: string;
  from: string;
  to: string | string[];
  subject: string;
  html: string;
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
  <p style="color:#64748b;font-size:12px;margin-top:32px;">Sent by Narfu</p>
  </body></html>`;
}
