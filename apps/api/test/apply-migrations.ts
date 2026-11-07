import { applyD1Migrations, env } from "cloudflare:test";
import { vi } from "vitest";

await applyD1Migrations(env.DB, (env as unknown as { TEST_MIGRATIONS: never[] }).TEST_MIGRATIONS);

// Tests must never send real email, whatever keys the local .dev.vars holds.
export const sentMail: Array<{ url: string; body: unknown }> = [];
const realFetch = globalThis.fetch;
vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (url.startsWith("https://api.resend.com/")) {
    sentMail.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
    return new Response(JSON.stringify({ id: "test" }), { status: 200 });
  }
  return realFetch(input, init);
});
