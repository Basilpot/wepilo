import type { Env } from "@/env";

function originOf(url: string) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

/**
 * Origins allowed to use a staff or platform cookie session: the dashboard, the marketing
 * site, and localhost during development. Tenant websites call with an API key or tenant
 * slug and never need staff cookies, so a cookie arriving from anywhere else is ignored.
 */
export function isTrustedOrigin(env: Pick<Env, "DASHBOARD_URL" | "SITE_URL" | "API_BASE_URL" | "ENVIRONMENT">, origin: string | undefined) {
  // No Origin header: same-origin GET or a non-browser client. Cross-site fetches always send one.
  if (!origin) return true;
  const trusted = [env.DASHBOARD_URL, env.SITE_URL, env.API_BASE_URL].map(originOf);
  if (trusted.includes(origin)) return true;
  return env.ENVIRONMENT !== "production" && LOCAL.test(origin);
}
