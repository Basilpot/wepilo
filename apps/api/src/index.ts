import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { app } from "@/app";
import type { Env } from "@/env";
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
    resourceMetadata: { resource: `${env.API_BASE_URL}/mcp`, resource_name: "Wepilo" },
    accessTokenTTL: 60 * 60,
    refreshTokenTTL: 60 * 60 * 24 * 90,
  });
  return provider;
}

export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) => oauthProvider(env).fetch(request, env, ctx),
  // Cron (wrangler.jsonc → triggers.crons): email owners whose trial or plan just ended.
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      sendExpiryNotices(env, getDb(env)).then((r) => console.log("expiry notices", JSON.stringify(r))),
    );
  },
} satisfies ExportedHandler<Env>;
