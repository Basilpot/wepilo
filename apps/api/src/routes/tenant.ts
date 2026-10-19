import { Hono } from "hono";
import { z } from "zod";
import { eq, and, count, sql, desc } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AppEnv } from "@/types";
import { ApiError, paginate, paginationSchema, getOffset } from "@/lib/http";
import { requireStaff, tenantLimits } from "@/middleware/context";
import { PLANS, SELF_SERVE_PLANS, TRIAL_DAYS, productIdFor, type SelfServePlan } from "@/lib/plans";
import { hashPassword } from "@/lib/auth";
import { sha256Hex, randomApiKey } from "@/lib/crypto";
import {
  dodoCreateCustomer,
  dodoCreateCheckout,
  dodoChangePlan,
  dodoCustomerPortal,
  dodoGetSubscription,
  dodoListPayments,
} from "@/lib/dodo";
import { applySubscription, catalogPrices, grantTrial, loadAccess, trialEmailTaken } from "@/lib/billing";

const profileSchema = z.object({
  companyName: z.string().min(1).optional(),
  companyLogo: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  companyDescription: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
});

const staffCreateSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["ADMIN", "MANAGER", "EDITOR"]).default("EDITOR"),
  permissions: z.array(z.string()).default([]),
});

export const tenantRoutes = new Hono<AppEnv>()
  .patch("/me", requireStaff("OWNER", "ADMIN"), async (c) => {
    const body = profileSchema.parse(await c.req.json());
    const db = c.get("db");
    const tenantId = c.get("tenantId");
    const [tenant] = await db
      .update(schema.tenants)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(schema.tenants.id, tenantId))
      .returning({ id: schema.tenants.id });
    return c.json({ tenant: { id: tenant.id } });
  })
  .get("/staff", requireStaff(), async (c) => {
    const db = c.get("db");
    const rows = await db.query.tenantStaff.findMany({
      where: eq(schema.tenantStaff.tenantId, c.get("tenantId")),
      orderBy: [desc(schema.tenantStaff.role), schema.tenantStaff.id],
    });
    return c.json({
      data: rows.map((s) => ({
        id: s.id,
        name: s.name,
        email: s.email,
        role: s.role,
        permissions: s.permissions,
        isActive: s.isActive,
        createdAt: s.createdAt,
      })),
    });
  })
  .post("/staff", requireStaff("OWNER", "ADMIN"), async (c) => {
    const body = staffCreateSchema.parse(await c.req.json());
    const db = c.get("db");
    const tenantId = c.get("tenantId");
    const { access, limits } = await tenantLimits(db, tenantId);
    const [rowCount] = await db
      .select({ value: count() })
      .from(schema.tenantStaff)
      .where(eq(schema.tenantStaff.tenantId, tenantId));
    if (rowCount.value >= limits.staff) {
      throw new ApiError(
        402,
        `Your ${PLANS[access.plan].name} plan includes ${limits.staff} staff logins. Upgrade to add more.`,
        "PLAN_LIMIT",
      );
    }
    const existing = await db.query.tenantStaff.findFirst({
      where: and(eq(schema.tenantStaff.tenantId, tenantId), eq(schema.tenantStaff.email, body.email.toLowerCase())),
    });
    if (existing) throw new ApiError(409, "Email already in use");
    const [staff] = await db
      .insert(schema.tenantStaff)
      .values({
        tenantId,
        name: body.name,
        email: body.email.toLowerCase(),
        password: await hashPassword(body.password),
        role: body.role,
        permissions: body.permissions,
      })
      .returning({ id: schema.tenantStaff.id, name: schema.tenantStaff.name, email: schema.tenantStaff.email, role: schema.tenantStaff.role });
    return c.json({ staff }, 201);
  })
  .patch("/staff/:id", requireStaff("OWNER", "ADMIN"), async (c) => {
    const id = Number(c.req.param("id"));
    const body = z
      .object({
        name: z.string().min(1).optional(),
        role: z.enum(["ADMIN", "MANAGER", "EDITOR"]).optional(),
        permissions: z.array(z.string()).optional(),
        isActive: z.boolean().optional(),
        password: z.string().min(8).optional(),
      })
      .parse(await c.req.json());
    const db = c.get("db");
    const tenantId = c.get("tenantId");
    const target = await db.query.tenantStaff.findFirst({
      where: and(eq(schema.tenantStaff.id, id), eq(schema.tenantStaff.tenantId, tenantId)),
    });
    if (!target) throw new ApiError(404, "Staff not found");
    if (target.role === "OWNER" && (body.role || body.isActive === false)) {
      throw new ApiError(400, "Cannot modify owner role or deactivate owner");
    }
    const [staff] = await db
      .update(schema.tenantStaff)
      .set({
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.role !== undefined ? { role: body.role } : {}),
        ...(body.permissions !== undefined ? { permissions: body.permissions } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        ...(body.password ? { password: await hashPassword(body.password) } : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.tenantStaff.id, id))
      .returning({ id: schema.tenantStaff.id });
    return c.json({ staff });
  })
  .delete("/staff/:id", requireStaff("OWNER", "ADMIN"), async (c) => {
    const id = Number(c.req.param("id"));
    const db = c.get("db");
    const tenantId = c.get("tenantId");
    const target = await db.query.tenantStaff.findFirst({
      where: and(eq(schema.tenantStaff.id, id), eq(schema.tenantStaff.tenantId, tenantId)),
    });
    if (!target) throw new ApiError(404, "Staff not found");
    if (target.role === "OWNER") throw new ApiError(400, "Cannot delete the owner");
    await db.delete(schema.tenantStaff).where(eq(schema.tenantStaff.id, id));
    return c.json({ ok: true });
  })
  .get("/api-key", requireStaff("OWNER", "ADMIN"), async (c) => {
    const db = c.get("db");
    const tenant = await db.query.tenants.findFirst({
      where: eq(schema.tenants.id, c.get("tenantId")),
      columns: { apiKeyHash: true },
    });
    return c.json({ configured: Boolean(tenant?.apiKeyHash) });
  })
  .post("/api-key", requireStaff("OWNER"), async (c) => {
    const db = c.get("db");
    const tenantId = c.get("tenantId");
    const { limits } = await tenantLimits(db, tenantId);
    if (!limits.apiAccess) {
      throw new ApiError(402, "API keys come with a paid plan. Your trial covers the dashboard only.", "PLAN_LIMIT");
    }
    const key = randomApiKey();
    await db
      .update(schema.tenants)
      .set({ apiKeyHash: await sha256Hex(key), updatedAt: new Date() })
      .where(eq(schema.tenants.id, tenantId));
    return c.json({ apiKey: key }, 201);
  })
  .delete("/api-key", requireStaff("OWNER"), async (c) => {
    const db = c.get("db");
    await db
      .update(schema.tenants)
      .set({ apiKeyHash: null, updatedAt: new Date() })
      .where(eq(schema.tenants.id, c.get("tenantId")));
    return c.json({ ok: true });
  })
  .get("/analytics", requireStaff(), async (c) => {
    const db = c.get("db");
    const tenantId = c.get("tenantId");

    const [tripStats] = await db
      .select({
        total: count(),
      })
      .from(schema.activities)
      .where(eq(schema.activities.tenantId, tenantId));

    const publishedTrips = await db
      .select({ value: count() })
      .from(schema.activities)
      .where(and(eq(schema.activities.tenantId, tenantId), eq(schema.activities.status, "PUBLISHED")));

    const draftTrips = await db
      .select({ value: count() })
      .from(schema.activities)
      .where(and(eq(schema.activities.tenantId, tenantId), eq(schema.activities.status, "DRAFT")));

    const confirmedBookings = await db
      .select({ value: count() })
      .from(schema.bookings)
      .where(and(eq(schema.bookings.tenantId, tenantId), eq(schema.bookings.status, "CONFIRMED")));

    const pendingBookings = await db
      .select({ value: count() })
      .from(schema.bookings)
      .where(and(eq(schema.bookings.tenantId, tenantId), eq(schema.bookings.status, "PENDING")));

    const newInquiries = await db
      .select({ value: count() })
      .from(schema.inquiries)
      .where(and(eq(schema.inquiries.tenantId, tenantId), eq(schema.inquiries.status, "NEW")));

    const [revenueRow] = await db
      .select({ total: sql<number>`coalesce(sum(${schema.bookings.totalPrice}), 0)` })
      .from(schema.bookings)
      .where(
        and(
          eq(schema.bookings.tenantId, tenantId),
          sql`${schema.bookings.status} IN ('CONFIRMED', 'COMPLETED')`,
        ),
      );

    const upcomingDepartures = await db.query.departures.findMany({
      where: and(
        eq(schema.departures.tenantId, tenantId),
        eq(schema.departures.status, "OPEN"),
        sql`${schema.departures.startDate} >= date('now')`,
      ),
      with: { activity: { columns: { title: true, slug: true } } },
      orderBy: [schema.departures.startDate],
      limit: 5,
    });

    const topActivities = await db.query.activities.findMany({
      where: and(eq(schema.activities.tenantId, tenantId), eq(schema.activities.status, "PUBLISHED")),
      orderBy: [desc(schema.activities.popularityScore)],
      limit: 5,
      columns: { id: true, title: true, slug: true, popularityScore: true, views: true, averageRating: true },
    });

    const monthly = await db.all<{
      month: string;
      bookings: number;
      revenue: number;
    }>(sql`
      SELECT strftime('%Y-%m', ${schema.bookings.createdAt} / 1000, 'unixepoch') AS month,
             COUNT(*) AS bookings,
             COALESCE(SUM(CASE WHEN ${schema.bookings.status} IN ('CONFIRMED','COMPLETED') THEN ${schema.bookings.totalPrice} ELSE 0 END), 0) AS revenue
      FROM ${schema.bookings}
      WHERE ${schema.bookings.tenantId} = ${tenantId}
        AND ${schema.bookings.createdAt} >= (unixepoch() * 1000) - 31536000000
      GROUP BY month
      ORDER BY month ASC
    `);

    return c.json({
      trips: {
        total: tripStats.total,
        published: publishedTrips[0].value,
        drafts: draftTrips[0].value,
      },
      bookings: {
        confirmed: confirmedBookings[0].value,
        pending: pendingBookings[0].value,
      },
      revenue: revenueRow.total,
      inquiriesNew: newInquiries[0].value,
      upcomingDepartures,
      topActivities,
      monthly,
    });
  })
  .get("/billing", requireStaff(), async (c) => {
    const db = c.get("db");
    const loaded = await loadAccess(db, c.get("tenantId"));
    if (!loaded) throw new ApiError(404, "Tenant not found");
    const prices = await catalogPrices(c.env).catch(() => ({}) as Record<string, null>);
    const priceOf = (id: string | undefined) => (id ? (prices[id] ?? null) : null);
    const json = (n: number) => (Number.isFinite(n) ? n : null);

    return c.json({
      access: loaded.access,
      subscription: loaded.subscription && {
        status: loaded.subscription.status,
        plan: loaded.subscription.plan,
        interval: loaded.subscription.interval,
        currentPeriodEnd: loaded.subscription.currentPeriodEnd,
        cancelAtPeriodEnd: loaded.subscription.cancelAtPeriodEnd,
        hasPaidSubscription: Boolean(loaded.subscription.dodoSubscriptionId),
      },
      trial: { days: TRIAL_DAYS, price: priceOf(c.env.DODO_TRIAL_PRODUCT_ID) },
      plans: SELF_SERVE_PLANS.map((key) => {
        const { name, tagline, limits } = PLANS[key];
        return {
          key,
          name,
          tagline,
          limits: {
            trips: json(limits.trips),
            posts: json(limits.posts),
            staff: json(limits.staff),
            storageBytes: json(limits.storageBytes),
            apiAccess: limits.apiAccess,
          },
          // null = not sold on that interval; { price: null } = sold, but the price couldn't be read from Dodo.
          intervals: {
            monthly: productIdFor(c.env, key, "monthly") ? { price: priceOf(productIdFor(c.env, key, "monthly")) } : null,
            annual: productIdFor(c.env, key, "annual") ? { price: priceOf(productIdFor(c.env, key, "annual")) } : null,
          },
        };
      }),
    });
  })
  // Step 1 for every new workspace: pay $1, get TRIAL_DAYS on the chosen plan, no auto-renewal.
  .post("/billing/trial", requireStaff("OWNER"), async (c) => {
    const body = z.object({ plan: z.enum(["STARTER", "GROWTH", "SCALE"]) }).parse(await c.req.json());
    const db = c.get("db");
    const tenantId = c.get("tenantId");
    const loaded = await loadAccess(db, tenantId);
    if (!loaded) throw new ApiError(404, "Tenant not found");
    if (!loaded.access.trialAvailable) throw new ApiError(409, "This workspace has already used its trial.", "TRIAL_USED");
    if (!loaded.access.locked) throw new ApiError(409, "Your workspace already has an active plan.", "ALREADY_ACTIVE");
    if (await trialEmailTaken(db, loaded.tenant.email, tenantId)) {
      throw new ApiError(409, "A trial has already been used with this email. Choose a plan to continue.", "TRIAL_USED");
    }
    const productId = c.env.DODO_TRIAL_PRODUCT_ID;
    if (!productId || productId.includes("replace")) throw new ApiError(503, "Trial checkout isn't configured yet.");

    const customerId = await ensureDodoCustomer(c.env, db, loaded.tenant);
    const session = await dodoCreateCheckout(c.env, {
      customerId,
      productId,
      subscription: false,
      returnUrl: `${c.env.DASHBOARD_URL}/billing/return?kind=trial`,
      metadata: { tenantId: String(tenantId), kind: "trial", plan: body.plan },
    });
    return c.json({ url: session.checkout_url });
  })
  // Buy a plan, or switch plan when a paid subscription already exists.
  .post("/billing/checkout", requireStaff("OWNER"), async (c) => {
    const body = z
      .object({
        plan: z.enum(["STARTER", "GROWTH", "SCALE"]),
        interval: z.enum(["monthly", "annual"]),
      })
      .parse(await c.req.json());
    const db = c.get("db");
    const tenantId = c.get("tenantId");
    const loaded = await loadAccess(db, tenantId);
    if (!loaded) throw new ApiError(404, "Tenant not found");
    const productId = productIdFor(c.env, body.plan, body.interval);
    if (!productId) throw new ApiError(400, `${PLANS[body.plan].name} isn't sold ${body.interval} yet.`);

    const sub = loaded.subscription;
    const metadata = { tenantId: String(tenantId), kind: "subscription", plan: body.plan, interval: body.interval };
    if (sub?.dodoSubscriptionId && (sub.status === "ACTIVE" || sub.status === "PAST_DUE")) {
      if (sub.productId === productId) throw new ApiError(409, "You're already on this plan.", "SAME_PLAN");
      try {
        await dodoChangePlan(c.env, sub.dodoSubscriptionId, productId, metadata);
      } catch (err) {
        console.error("Dodo change-plan failed", err);
        throw new ApiError(502, "The plan change didn't go through. Check your payment method and try again.");
      }
      return c.json({ changed: true });
    }

    const customerId = await ensureDodoCustomer(c.env, db, loaded.tenant);
    const session = await dodoCreateCheckout(c.env, {
      customerId,
      productId,
      subscription: true,
      returnUrl: `${c.env.DASHBOARD_URL}/billing/return?kind=subscription`,
      metadata,
    });
    return c.json({ url: session.checkout_url });
  })
  // Called when Dodo sends the customer back. Asks Dodo directly what was paid, so access unlocks
  // even if the webhook is slow or (locally) can't reach us. Webhooks stay the source of truth for
  // renewals, failures and cancellations.
  .post("/billing/confirm", requireStaff(), async (c) => {
    const db = c.get("db");
    const tenantId = c.get("tenantId");
    let loaded = await loadAccess(db, tenantId);
    if (!loaded) throw new ApiError(404, "Tenant not found");
    const customerId = loaded.tenant.dodoCustomerId;
    if (!customerId) return c.json({ access: loaded.access, applied: false });

    const mine = (m: Record<string, unknown>) => String(m.tenantId ?? "") === String(tenantId);
    let applied = false;
    try {
      const { items } = await dodoListPayments(c.env, customerId);
      const ours = items.filter((p) => p.status === "succeeded" && mine(p.metadata ?? {}));

      const trialPayment = ours.find((p) => p.metadata.kind === "trial");
      if (trialPayment && !loaded.tenant.trialUsedAt) {
        const plan = SELF_SERVE_PLANS.includes(trialPayment.metadata.plan as SelfServePlan)
          ? (trialPayment.metadata.plan as SelfServePlan)
          : "STARTER";
        applied = (await grantTrial(db, { tenantId, plan, customerId })).applied || applied;
      }

      const subPayment = ours
        .filter((p) => p.subscription_id)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      if (subPayment?.subscription_id) {
        const sub = await dodoGetSubscription(c.env, subPayment.subscription_id);
        if (sub.customer?.customer_id === customerId) {
          applied = (await applySubscription(db, c.env, tenantId, sub)).applied || applied;
        }
      }
    } catch (err) {
      console.error("Billing confirm failed", err);
    }

    loaded = await loadAccess(db, tenantId);
    return c.json({ access: loaded?.access ?? null, applied });
  })
  // Dodo's hosted portal: cancel, update card, download invoices.
  .post("/billing/portal", requireStaff("OWNER"), async (c) => {
    const db = c.get("db");
    const loaded = await loadAccess(db, c.get("tenantId"));
    if (!loaded?.tenant.dodoCustomerId) throw new ApiError(409, "There's no billing account yet.", "NO_CUSTOMER");
    const portal = await dodoCustomerPortal(c.env, loaded.tenant.dodoCustomerId, `${c.env.DASHBOARD_URL}/settings/billing`);
    return c.json({ url: portal.link });
  });

async function ensureDodoCustomer(env: AppEnv["Bindings"], db: AppEnv["Variables"]["db"], tenant: schema.Tenant) {
  if (tenant.dodoCustomerId) return tenant.dodoCustomerId;
  const customer = await dodoCreateCustomer(env, tenant.email, tenant.companyName ?? undefined);
  await db
    .update(schema.tenants)
    .set({ dodoCustomerId: customer.customer_id, updatedAt: new Date() })
    .where(eq(schema.tenants.id, tenant.id));
  return customer.customer_id;
}
