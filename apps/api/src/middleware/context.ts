import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { eq, and, sql } from "drizzle-orm";
import type { Env } from "@/env";
import { getDb, type Db } from "@/db";
import * as schema from "@/db/schema";
import { verifyToken, staffCookieName, userCookieName, type StaffTokenPayload, type UserTokenPayload } from "@/lib/auth";
import { sha256Hex } from "@/lib/crypto";
import { ApiError } from "@/lib/http";
import { loadAccess, limitsFor, websiteApiOpen } from "@/lib/billing";
import { PLANS } from "@/lib/plans";

export type AppVariables = {
  db: Db;
  tenantId: number;
  staff: schema.TenantStaff | null;
  user: schema.User | null;
  tenant: schema.Tenant | null;
};

export const appContext = createMiddleware<{ Bindings: Env; Variables: AppVariables }>(
  async (c, next) => {
    const db = getDb(c.env);
    c.set("db", db);
    c.set("staff", null);
    c.set("user", null);
    c.set("tenant", null);

    const staffToken = getCookie(c, staffCookieName);
    if (staffToken) {
      const payload = await verifyToken<StaffTokenPayload>(c.env, staffToken);
      if (payload?.kind === "staff") {
        const staff = await db.query.tenantStaff.findFirst({
          where: and(
            eq(schema.tenantStaff.id, payload.staffId),
            eq(schema.tenantStaff.tenantId, payload.tenantId),
            eq(schema.tenantStaff.isActive, true),
          ),
        });
        if (staff) {
          c.set("staff", staff);
          c.set("tenantId", staff.tenantId);
        }
      }
    }

    if (!c.get("tenantId")) {
      const userToken = getCookie(c, userCookieName);
      if (userToken) {
        const payload = await verifyToken<UserTokenPayload>(c.env, userToken);
        if (payload?.kind === "user") {
          const user = await db.query.users.findFirst({
            where: and(eq(schema.users.id, payload.userId), eq(schema.users.tenantId, payload.tenantId)),
          });
          if (user) {
            c.set("user", user);
            c.set("tenantId", user.tenantId);
          }
        }
      }
    }

    if (!c.get("tenantId")) {
      const apiKey = c.req.header("x-api-key");
      if (apiKey) {
        const hash = await sha256Hex(apiKey);
        const tenant = await db.query.tenants.findFirst({
          where: eq(schema.tenants.apiKeyHash, hash),
        });
        if (tenant && tenant.status === "ACTIVE") {
          c.set("tenantId", tenant.id);
          c.set("tenant", tenant);
        }
      }
    }

    if (!c.get("tenantId")) {
      const slug = c.req.header("x-tenant-slug");
      if (slug) {
        const tenant = await db.query.tenants.findFirst({ where: eq(schema.tenants.slug, slug) });
        if (tenant && tenant.status === "ACTIVE") {
          c.set("tenantId", tenant.id);
          c.set("tenant", tenant);
        }
      }
    }

    await next();
  },
);

export function requireStaff(...roles: Array<StaffTokenPayload["role"]>) {
  return createMiddleware<{ Bindings: Env; Variables: AppVariables }>(async (c, next) => {
    const staff = c.get("staff");
    if (!staff) return c.json({ error: "Authentication required" }, 401);
    if (roles.length > 0 && !roles.includes(staff.role)) {
      return c.json({ error: "Insufficient permissions" }, 403);
    }
    await next();
  });
}

export function requireUser() {
  return createMiddleware<{ Bindings: Env; Variables: AppVariables }>(async (c, next) => {
    if (!c.get("user")) return c.json({ error: "Authentication required" }, 401);
    await next();
  });
}

export function requireTenant() {
  return createMiddleware<{ Bindings: Env; Variables: AppVariables }>(async (c, next) => {
    if (!c.get("tenantId")) return c.json({ error: "Tenant context required" }, 400);
    await next();
  });
}

/** Limits for the tenant right now; everything is 0 while the workspace is locked. */
export async function tenantLimits(db: Db, tenantId: number) {
  const loaded = await loadAccess(db, tenantId);
  if (!loaded) throw new ApiError(404, "Tenant not found");
  return { ...loaded, limits: limitsFor(loaded.access) };
}

function lockedError() {
  return new ApiError(402, "Your workspace needs an active plan. Start your trial or choose a plan to continue.", "PAYMENT_REQUIRED");
}

const LIMIT_LABELS = { trips: "trip", posts: "post" } as const;

/**
 * Throws 402 PLAN_LIMIT when the tenant already uses everything its plan allows.
 * Trips count every trip (drafts included); posts skip ones in the trash.
 */
export async function assertPlanLimit(db: Db, tenantId: number, resource: "trips" | "posts") {
  const { access, limits } = await tenantLimits(db, tenantId);
  if (access.locked) throw lockedError();
  const limit = limits[resource];
  if (limit === Infinity) return;

  const [row] =
    resource === "trips"
      ? await db
          .select({ value: sql<number>`count(*)` })
          .from(schema.activities)
          .where(eq(schema.activities.tenantId, tenantId))
      : await db
          .select({ value: sql<number>`count(*)` })
          .from(schema.blogs)
          .where(and(eq(schema.blogs.tenantId, tenantId), eq(schema.blogs.inTrash, false)));

  if (row.value >= limit) {
    throw new ApiError(
      402,
      `Your ${PLANS[access.plan].name} plan allows ${limit} ${LIMIT_LABELS[resource]}s. Upgrade to add more.`,
      "PLAN_LIMIT",
    );
  }
}

/** Paths that stay open while a workspace is locked: signing in/out and paying. */
const OPEN_WHEN_LOCKED = [/^\/api\/v1\/auth\//, /^\/api\/v1\/billing\//, /^\/api\/v1\/tenant\/billing(\/|$)/];

/**
 * No access without payment.
 * - Dashboard (staff session): needs an active trial or plan.
 * - Website (API key / tenant slug / traveller session): needs a paid plan; keeps working
 *   API_GRACE_DAYS after a subscription lapses; never during the trial.
 */
export const requirePaidAccess = createMiddleware<{ Bindings: Env; Variables: AppVariables }>(async (c, next) => {
  const tenantId = c.get("tenantId");
  if (!tenantId || OPEN_WHEN_LOCKED.some((re) => re.test(c.req.path))) return next();
  const loaded = await loadAccess(c.get("db"), tenantId);
  if (!loaded) return c.json({ error: "Tenant not found" }, 404);

  if (c.get("staff")) {
    if (loaded.access.locked) {
      const err = lockedError();
      return c.json({ error: err.message, code: err.code }, 402);
    }
  } else if (!websiteApiOpen(loaded.access)) {
    return c.json(
      {
        error:
          loaded.access.state === "TRIAL"
            ? "API access starts with a paid plan."
            : "This site's Narfu plan is inactive.",
        code: "API_ACCESS_INACTIVE",
      },
      402,
    );
  }
  await next();
});

export async function getTenantOrThrow(db: Db, tenantId: number) {
  const tenant = await db.query.tenants.findFirst({ where: eq(schema.tenants.id, tenantId) });
  if (!tenant) throw new ApiError(404, "Tenant not found");
  return tenant;
}
