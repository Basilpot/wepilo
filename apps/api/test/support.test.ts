import { describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:test";
import * as schema from "@/db/schema";
import { hashPassword, signToken } from "@/lib/auth";
import { call, db, makeTenant } from "./helpers";

/** A Wepilo team member, with a session cookie of their own. */
async function makePlatformAdmin() {
  const [admin] = await db()
    .insert(schema.platformAdmins)
    .values({
      email: `admin-${Date.now()}@test.dev`,
      name: "Wepilo Support",
      password: await hashPassword("password123"),
    })
    .returning();
  const token = await signToken(env, { kind: "platform", adminId: admin.id }, "1h");
  return { admin, token };
}

/** Captures the mail that goes out while the test runs. */
async function captureMail(run: () => Promise<void>) {
  const sent: Array<{ to: string[]; subject: string; body: string }> = [];
  const realFetch = globalThis.fetch;
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const u = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (u.startsWith("https://api.resend.com/")) {
      const body = JSON.parse(String(init?.body));
      sent.push({ to: body.to, subject: body.subject, body: body.html });
      return new Response("{}", { status: 200 });
    }
    return realFetch(input, init);
  });
  try {
    await run();
  } finally {
    vi.stubGlobal("fetch", realFetch);
  }
  return sent;
}

async function makeTicket(token: string, subject = "The November departure is full") {
  const res = await call("/api/v1/support", {
    method: "POST",
    staff: token,
    body: { category: "Bookings", subject, message: "Is the 10 November departure still open for two?", priority: "HIGH" },
  });
  expect(res.status).toBe(201);
  return res.json.ticket as { id: number };
}

describe("the support loop", () => {
  it("emails the Wepilo team when an agency writes a request", async () => {
    const { token } = await makeTenant();
    (env as { RESEND_API_KEY: string }).RESEND_API_KEY = "re_platform_test";

    const sent = await captureMail(async () => {
      await makeTicket(token);
    });

    expect(sent.length).toBe(1);
    expect(sent[0].to).toEqual(["support@example.com"]);
    expect(sent[0].subject).toContain("The November departure is full");
    expect(sent[0].body).toContain("/admin/support/");
  });

  it("shows the Wepilo team every request, with the workspace it came from", async () => {
    const { token, tenant } = await makeTenant();
    await makeTenant();
    const ticket = await makeTicket(token);

    const { token: adminToken } = await makePlatformAdmin();
    const list = await call("/api/v1/platform/support", { headers: { cookie: `wepilo_platform_token=${adminToken}` } });

    expect(list.status).toBe(200);
    expect(list.json.data.map((t: { id: number }) => t.id)).toContain(ticket.id);
    const found = list.json.data.find((t: { id: number }) => t.id === ticket.id);
    expect(found.tenant.id).toBe(tenant.id);
    expect(found.priority).toBe("HIGH");
  });

  it("puts the Wepilo reply in the agency's thread and emails them", async () => {
    const { token, tenant } = await makeTenant();
    const ticket = await makeTicket(token);
    const { token: adminToken } = await makePlatformAdmin();

    (env as { RESEND_API_KEY: string }).RESEND_API_KEY = "re_platform_test";
    const sent = await captureMail(async () => {
      const reply = await call(`/api/v1/platform/support/${ticket.id}/replies`, {
        method: "POST",
        headers: { cookie: `wepilo_platform_token=${adminToken}` },
        body: { message: "There are six seats left on 10 November." },
      });
      expect(reply.status).toBe(201);
    });

    // The agency sees it in their own thread, from Wepilo and not from a staff login.
    const thread = await call(`/api/v1/support/${ticket.id}`, { staff: token });
    expect(thread.status).toBe(200);
    expect(thread.json.ticket.replies).toHaveLength(1);
    expect(thread.json.ticket.replies[0].message).toContain("six seats left");
    expect(thread.json.ticket.replies[0].staff).toBeNull();
    expect(thread.json.ticket.replies[0].authorName).toBe("Wepilo Support");

    // And they are emailed about it.
    expect(sent.length).toBe(1);
    expect(sent[0].to).toEqual([tenant.email]);
    expect(sent[0].subject).toContain("Wepilo replied");
  });

  it("moves a ticket to in progress once Wepilo answers", async () => {
    const { token } = await makeTenant();
    const ticket = await makeTicket(token);
    const { token: adminToken } = await makePlatformAdmin();

    await call(`/api/v1/platform/support/${ticket.id}/replies`, {
      method: "POST",
      headers: { cookie: `wepilo_platform_token=${adminToken}` },
      body: { message: "Looking into it." },
    });

    const thread = await call(`/api/v1/support/${ticket.id}`, { staff: token });
    expect(thread.json.ticket.status).toBe("IN_PROGRESS");
  });

  it("keeps the inbox away from the agencies", async () => {
    const { token } = await makeTenant();
    const ticket = await makeTicket(token);

    const denied = await call("/api/v1/platform/support", { staff: token });
    expect(denied.status).toBe(401);

    const reply = await call(`/api/v1/platform/support/${ticket.id}/replies`, {
      method: "POST",
      staff: token,
      body: { message: "Let me in." },
    });
    expect(reply.status).toBe(401);
  });

  it("tells the Wepilo team when the agency replies", async () => {
    const { token } = await makeTenant();
    const ticket = await makeTicket(token);
    (env as { RESEND_API_KEY: string }).RESEND_API_KEY = "re_platform_test";

    const sent = await captureMail(async () => {
      const res = await call(`/api/v1/support/${ticket.id}/replies`, {
        method: "POST",
        staff: token,
        body: { message: "Any news?" },
      });
      expect(res.status).toBe(201);
    });

    expect(sent.length).toBe(1);
    expect(sent[0].to).toEqual(["support@example.com"]);
    expect(sent[0].subject).toContain("Reply on:");
  });
});
