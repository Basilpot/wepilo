import { Hono } from "hono";
import { z } from "zod";
import { eq, and, asc, count, sql, desc, isNotNull, ne } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AppEnv } from "@/types";
import { ApiError, paginate, paginationSchema, getOffset, slugify } from "@/lib/http";
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
import { applySubscription, catalogPrices, grantTrial, loadAccess, loadAccessForTrial, trialEmailTaken } from "@/lib/billing";
import { hasAccount } from "@/lib/account";
import { langCode } from "@/lib/i18n";

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
  /** Only needed for a brand-new login. Someone who already signs in keeps their own password. */
  password: z.string().min(8).optional(),
  role: z.enum(["ADMIN", "MANAGER", "EDITOR", "AUTHOR"]).default("EDITOR"),
  permissions: z.array(z.string()).default([]),
  /** Public byline profile. The username is made from the name when left out. */
  username: z.string().trim().min(3).max(40).optional(),
  bio: z.string().max(2000).optional(),
  image: z.string().optional(),
});

/** A free public username for a staff member, made from what they typed: "Maya Sharma" becomes "maya-sharma", then "maya-sharma-2" if taken. */
async function uniqueUsername(db: AppEnv["Variables"]["db"], tenantId: number, wanted: string, selfId?: number) {
  const base = slugify(wanted).slice(0, 40) || "author";
  for (let i = 1; i < 50; i++) {
    const candidate = i === 1 ? base : `${base}-${i}`;
    const clash = await db.query.tenantStaff.findFirst({
      where: and(eq(schema.tenantStaff.tenantId, tenantId), eq(schema.tenantStaff.username, candidate)),
      columns: { id: true },
    });
    if (!clash || clash.id === selfId) return candidate;
  }
  return `${base}-${Date.now()}`;
}

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
  // ── Languages ──────────────────────────────────────────────────────────────
  // The language content is written in, and the extra languages the site is published in.
  // Translations themselves live on each record (see lib/i18n.ts).
  .get("/languages", requireStaff(), async (c) => {
    const tenant = await c.get("db").query.tenants.findFirst({
      where: eq(schema.tenants.id, c.get("tenantId")),
      columns: { defaultLanguage: true, languages: true },
    });
    if (!tenant) throw new ApiError(404, "Tenant not found");
    return c.json({ defaultLanguage: tenant.defaultLanguage, languages: tenant.languages ?? [] });
  })
  .put("/languages", requireStaff("OWNER", "ADMIN"), async (c) => {
    const body = z
      .object({ defaultLanguage: langCode, languages: z.array(langCode).max(20) })
      .parse(await c.req.json());
    const languages = [...new Set(body.languages)].filter((l) => l !== body.defaultLanguage);
    await c
      .get("db")
      .update(schema.tenants)
      .set({ defaultLanguage: body.defaultLanguage, languages, updatedAt: new Date() })
      .where(eq(schema.tenants.id, c.get("tenantId")));
    return c.json({ defaultLanguage: body.defaultLanguage, languages });
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
        username: s.username,
        bio: s.bio,
        image: s.image,
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

    // A person who already signs in to Wepilo keeps their own password. Only a brand-new
    // login needs one, so this workspace can't take over an account the person owns elsewhere.
    const account = await db.query.tenantStaff.findFirst({
      where: eq(schema.tenantStaff.email, body.email.toLowerCase()),
      orderBy: [asc(schema.tenantStaff.id)],
    });
    if (!account && !body.password) {
      throw new ApiError(400, "A temporary password is needed for a new login.", "VALIDATION");
    }
    const username = await uniqueUsername(db, tenantId, body.username ?? body.name);
    const [staff] = await db
      .insert(schema.tenantStaff)
      .values({
        tenantId,
        username,
        bio: body.bio ?? null,
        image: body.image ?? null,
        name: body.name,
        email: body.email.toLowerCase(),
        password: account ? account.password : await hashPassword(body.password!),
        role: body.role,
        permissions: body.permissions,
      })
      .returning({ id: schema.tenantStaff.id, name: schema.tenantStaff.name, email: schema.tenantStaff.email, role: schema.tenantStaff.role });
    return c.json({ staff, existingAccount: Boolean(account) }, 201);
  })
  .patch("/staff/:id", requireStaff("OWNER", "ADMIN"), async (c) => {
    const id = Number(c.req.param("id"));
    const body = z
      .object({
        name: z.string().min(1).optional(),
        role: z.enum(["ADMIN", "MANAGER", "EDITOR", "AUTHOR"]).optional(),
        permissions: z.array(z.string()).optional(),
        username: z.string().trim().min(3).max(40).optional(),
        bio: z.string().max(2000).nullable().optional(),
        image: z.string().nullable().optional(),
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
    if (body.password && (await hasAccount(db, target.email, tenantId))) {
      // Their password belongs to them, not to this workspace. Changing it here would change
      // it everywhere they can sign in, so this workspace never sets it.
      throw new ApiError(409, "This person signs in with their own password. Ask them to reset it instead.", "PASSWORD_OWNED");
    }
    const [staff] = await db
      .update(schema.tenantStaff)
      .set({
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.role !== undefined ? { role: body.role } : {}),
        ...(body.permissions !== undefined ? { permissions: body.permissions } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        ...(body.username !== undefined ? { username: await uniqueUsername(db, tenantId, body.username, id) } : {}),
        ...(body.bio !== undefined ? { bio: body.bio } : {}),
        ...(body.image !== undefined ? { image: body.image } : {}),
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

    // Drafts with a publish date: trips, posts and pages waiting to go live.
    const [scheduledTrips, scheduledPosts, scheduledPages] = await Promise.all([
      db.select({ value: count() }).from(schema.activities).where(and(eq(schema.activities.tenantId, tenantId), isNotNull(schema.activities.publishAt))),
      db.select({ value: count() }).from(schema.blogs).where(and(eq(schema.blogs.tenantId, tenantId), isNotNull(schema.blogs.publishAt))),
      db.select({ value: count() }).from(schema.infoPages).where(and(eq(schema.infoPages.tenantId, tenantId), isNotNull(schema.infoPages.publishAt))),
    ]);

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

    return c.json({
      trips: {
        total: tripStats.total,
        published: publishedTrips[0].value,
        drafts: draftTrips[0].value,
      },
      scheduled: scheduledTrips[0].value + scheduledPosts[0].value + scheduledPages[0].value,
      upcomingDepartures,
      topActivities,
    });
  })
  .get("/billing", requireStaff(), async (c) => {
    const db = c.get("db");
    const loaded = await loadAccessForTrial(db, c.get("tenantId"));
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
  // Step 1 for every new workspace: pay $2.99, get TRIAL_DAYS on the chosen plan, no auto-renewal.
  .post("/billing/trial", requireStaff("OWNER"), async (c) => {
    const body = z.object({ plan: z.enum(["PRO"]).default("PRO") }).parse(await c.req.json());
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
        plan: z.enum(["PRO"]).default("PRO"),
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
        const plan: SelfServePlan = "PRO";
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
  // One person, one billing customer: another workspace of the same owner already has one.
  const sibling = await db.query.tenants.findFirst({
    where: and(
      eq(schema.tenants.email, tenant.email),
      isNotNull(schema.tenants.dodoCustomerId),
      ne(schema.tenants.id, tenant.id),
    ),
    columns: { dodoCustomerId: true },
  });
  if (sibling?.dodoCustomerId) {
    await db
      .update(schema.tenants)
      .set({ dodoCustomerId: sibling.dodoCustomerId, updatedAt: new Date() })
      .where(eq(schema.tenants.id, tenant.id));
    return sibling.dodoCustomerId;
  }
  const customer = await dodoCreateCustomer(env, tenant.email, tenant.companyName ?? undefined);
  await db
    .update(schema.tenants)
    .set({ dodoCustomerId: customer.customer_id, updatedAt: new Date() })
    .where(eq(schema.tenants.id, tenant.id));
  return customer.customer_id;
}
