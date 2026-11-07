import { createMiddleware } from "hono/factory";
import { lt, sql } from "drizzle-orm";
import type { Context } from "hono";
import type { Db } from "@/db";
import * as schema from "@/db/schema";
import type { AppEnv } from "@/types";
import { ApiError } from "@/lib/http";

export type Limit = {
  /** Name of the bucket, e.g. "login". Combined with the caller key. */
  name: string;
  /** Hits allowed per window. */
  max: number;
  windowSeconds: number;
};

/** What Cloudflare reports as the client when one Worker calls another on the same zone. */
const WORKER_SUBREQUEST_IP = "2a06:98c0:3600::103";

/**
 * Client IP as Cloudflare sees it; falls back to a shared bucket in local dev.
 * The dashboard Worker proxies /api, so behind it the visitor arrives in x-wepilo-client-ip.
 * That header is believed only when the connection itself is the Worker subrequest address,
 * which an outside caller can't have, so it can't be used to dodge a limit.
 */
export function clientIp(c: Context) {
  const connecting = c.req.header("cf-connecting-ip");
  if (connecting === WORKER_SUBREQUEST_IP) return c.req.header("x-wepilo-client-ip") ?? connecting;
  return connecting ?? "local";
}

/**
 * Counts one hit in a fixed window and reports whether the caller is over the limit.
 * One atomic upsert, so concurrent requests can't slip past the count.
 */
export async function hit(db: Db, limit: Limit, callerKey: string, now = Date.now()) {
  const windowMs = limit.windowSeconds * 1000;
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const key = `${limit.name}:${callerKey}`;
  const [row] = await db
    .insert(schema.rateLimits)
    .values({ key, windowStart, hits: 1 })
    .onConflictDoUpdate({
      target: [schema.rateLimits.key, schema.rateLimits.windowStart],
      set: { hits: sql`${schema.rateLimits.hits} + 1` },
    })
    .returning({ hits: schema.rateLimits.hits });
  const retryAfter = Math.max(1, Math.ceil((windowStart + windowMs - now) / 1000));
  return { limited: row.hits > limit.max, retryAfter };
}

/** Throws 429 once `callerKey` exceeds the limit. */
export async function enforce(db: Db, limit: Limit, callerKey: string) {
  const { limited, retryAfter } = await hit(db, limit, callerKey);
  if (limited) {
    throw new ApiError(429, "Too many requests. Please wait a moment and try again.", "RATE_LIMITED", {
      "Retry-After": String(retryAfter),
    });
  }
}

/** Route middleware: limit per client IP (and tenant, so one noisy site can't starve others). */
export function rateLimit(limit: Limit) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const tenantPart = c.get("tenantId") ?? 0;
    await enforce(c.get("db"), limit, `${tenantPart}:${clientIp(c)}`);
    await next();
  });
}

/** Drops windows that can no longer matter. Called from the hourly cron. */
export async function sweepRateLimits(db: Db, now = Date.now()) {
  await db.delete(schema.rateLimits).where(lt(schema.rateLimits.windowStart, now - 2 * 60 * 60 * 1000));
}

export const LIMITS = {
  /** Password guesses: per IP + email. */
  login: { name: "login", max: 8, windowSeconds: 15 * 60 },
  /** Anything that sends an email or creates accounts: per IP. */
  account: { name: "account", max: 10, windowSeconds: 60 * 60 },
  /** Public website forms (inquiry, booking request, newsletter, review): per IP + tenant. */
  publicForm: { name: "public-form", max: 12, windowSeconds: 10 * 60 },
} satisfies Record<string, Limit>;
