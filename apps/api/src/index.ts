import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { app } from "@/app";
import type { Env } from "@/env";
import { sweepRateLimits } from "@/lib/rate-limit";
import { publishDue } from "@/lib/publish";
import { getDb } from "@/db";
import { sendExpiryNotices } from "@/lib/billing";
import { mcpHandler } from "@/mcp/server";

/**
 * The OAuth provider fronts the whole Worker: `/mcp` requires a connector access token and is
 * answered by the MCP server; every other request (the REST API, `/oauth/authorize`, `/llms.txt`)
 * falls through to the Hono app with the OAuth helpers available as `env.OAUTH_PROVIDER`.
 * Built on first use because the resource URL comes from the environment.
 */
let provider: OAuthProvider<Env> | null = null;
function oauthProvider(env: Env) {
  provider ??= new OAuthProvider<Env>({
    apiRoute: "/mcp",
    apiHandler: {
      fetch: (request, env, ctx) => mcpHandler(env, ctx)(request, env, ctx),
    },
    defaultHandler: { fetch: (request, env, ctx) => app.fetch(request, env, ctx) },
    authorizeEndpoint: "/oauth/authorize",
    tokenEndpoint: "/oauth/token",
    clientRegistrationEndpoint: "/oauth/register",
    scopesSupported: ["wepilo"],
    requiredScopes: ["wepilo"],
    resourceMetadata: { resource: `${env.API_BASE_URL}/mcp`, resource_name: "Wepilo" },
    accessTokenTTL: 60 * 60,
    refreshTokenTTL: 60 * 60 * 24 * 90,
  });
  return provider;
}

export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) => oauthProvider(env).fetch(request, env, ctx),
  // Cron (wrangler.jsonc → triggers.crons), every 5 minutes: put scheduled content live.
  // Once an hour (the first run of each hour) it also emails owners whose trial or plan just
  // ended and sweeps old rate-limit windows.
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    const db = getDb(env);
    ctx.waitUntil(publishDue(db).then((r) => r.trips + r.posts + r.pages > 0 && console.log("published", JSON.stringify(r))));
    if (new Date(controller.scheduledTime).getUTCMinutes() < 5) {
      ctx.waitUntil(sendExpiryNotices(env, db).then((r) => console.log("expiry notices", JSON.stringify(r))));
      ctx.waitUntil(sweepRateLimits(db));
    }
  },
} satisfies ExportedHandler<Env>;
