import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { authorizationErrorRedirect, type AuthRequest, type OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import * as schema from "@/db/schema";
import type { Env } from "@/env";
import { ApiError } from "@/lib/http";
import { requireStaff } from "@/middleware/context";
import type { AppEnv } from "@/types";
import { grantUserId, type ConnectionProps } from "./props";

/** Pending authorization requests wait here while the person approves them in the dashboard. */
const PENDING_TTL_SECONDS = 600;
const pendingKey = (id: string) => `wepilo:connect:${id}`;

function helpers(env: Env): OAuthHelpers {
  if (!env.OAUTH_PROVIDER) throw new ApiError(500, "OAuth is not available on this request.");
  return env.OAUTH_PROVIDER;
}

async function readPending(env: Env, id: string) {
  const pending = await env.OAUTH_KV.get<{ request: AuthRequest }>(pendingKey(id), "json");
  if (!pending) throw new ApiError(404, "This connection request has expired. Start connecting again from your AI app.", "CONNECT_EXPIRED");
  return pending.request;
}

/**
 * `GET /oauth/authorize`: the OAuth provider's authorization endpoint. The staff session lives on
 * the dashboard's domain, so the request is parked in KV and the person approves it there.
 */
export const oauthAuthorizeRoutes = new Hono<AppEnv>().get("/authorize", async (c) => {
  let request: AuthRequest;
  try {
    request = await helpers(c.env).parseAuthRequest(c.req.raw);
  } catch (err) {
    return c.text(`This connection request is not valid: ${err instanceof Error ? err.message : "unknown error"}`, 400);
  }
  const id = crypto.randomUUID();
  await c.env.OAUTH_KV.put(pendingKey(id), JSON.stringify({ request }), { expirationTtl: PENDING_TTL_SECONDS });
  return c.redirect(`${c.env.DASHBOARD_URL}/connect?request=${id}`, 302);
});

/** Dashboard-facing routes under `/api/v1/connect`, all as the signed-in staff member. */
export const connectRoutes = new Hono<AppEnv>()
  .get("/requests/:id", requireStaff(), async (c) => {
    const request = await readPending(c.env, c.req.param("id"));
    const client = await helpers(c.env).lookupClient(request.clientId);
    const staff = c.get("staff")!;
    const tenant = await c.get("db").query.tenants.findFirst({ where: eq(schema.tenants.id, staff.tenantId) });
    return c.json({
      client: {
        name: client?.clientName ?? "An AI app",
        uri: client?.clientUri ?? null,
        logo: client?.logoUri ?? null,
      },
      redirectHost: new URL(request.redirectUri).host,
      staff: { name: staff.name, email: staff.email, role: staff.role },
      companyName: tenant?.companyName ?? tenant?.slug ?? "your workspace",
    });
  })
  .post("/requests/:id/approve", requireStaff(), async (c) => {
    const id = c.req.param("id");
    const request = await readPending(c.env, id);
    const staff = c.get("staff")!;
    const oauth = helpers(c.env);
    const [client, tenant] = await Promise.all([
      oauth.lookupClient(request.clientId),
      c.get("db").query.tenants.findFirst({ where: eq(schema.tenants.id, staff.tenantId) }),
    ]);
    const props: ConnectionProps = {
      staffId: staff.id,
      tenantId: staff.tenantId,
      role: staff.role,
      staffName: staff.name,
      companyName: tenant?.companyName ?? tenant?.slug ?? "Wepilo workspace",
    };
    const { redirectTo } = await oauth.completeAuthorization({
      request,
      userId: grantUserId(staff.id),
      scope: ["wepilo"],
      metadata: { clientName: client?.clientName ?? null, approvedAt: Date.now() },
      props,
    });
    await c.env.OAUTH_KV.delete(pendingKey(id));
    return c.json({ redirectTo });
  })
  .post("/requests/:id/deny", requireStaff(), async (c) => {
    const id = c.req.param("id");
    const request = await readPending(c.env, id);
    await c.env.OAUTH_KV.delete(pendingKey(id));
    return c.json({ redirectTo: authorizationErrorRedirect(request, "access_denied", "The Wepilo user declined the connection.") });
  })
  .get("/grants", requireStaff(), async (c) => {
    const staff = c.get("staff")!;
    const oauth = helpers(c.env);
    const { items } = await oauth.listUserGrants(grantUserId(staff.id), { limit: 50 });
    const grants = await Promise.all(
      items.map(async (g) => ({
        id: g.id,
        clientName: g.metadata?.clientName ?? (await oauth.lookupClient(g.clientId).catch(() => null))?.clientName ?? "An AI app",
        createdAt: g.createdAt * 1000,
      })),
    );
    grants.sort((a, b) => b.createdAt - a.createdAt);
    return c.json({ data: grants, mcpUrl: `${c.env.API_BASE_URL}/mcp` });
  })
  .delete("/grants/:id", requireStaff(), async (c) => {
    const staff = c.get("staff")!;
    await helpers(c.env).revokeGrant(c.req.param("id"), grantUserId(staff.id));
    return c.json({ ok: true });
  });
