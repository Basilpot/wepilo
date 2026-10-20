import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { z } from "zod";
import { and, count, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { Db } from "@/db";
import type { AppEnv } from "@/types";
import { ApiError, getOffset, paginate, paginationSchema, slugify } from "@/lib/http";
import {
  clearPlatformAuthCookie,
  hashPassword,
  platformCookieName,
  setPlatformAuthCookie,
  setStaffAuthCookie,
  signToken,
  verifyPassword,
  verifyToken,
  type PlatformTokenPayload,
} from "@/lib/auth";
import { accessFor } from "@/lib/billing";
import { PLAN_KEYS } from "@/lib/plans";
import { issueStaffToken } from "@/lib/staff-tokens";
import { escapeHtml, layout, sendEmail } from "@/lib/email";
import type { Env } from "@/env";

const IMPERSONATION_SECONDS = 60 * 60;

/** Loads the platform admin from its own cookie. Workspace sessions never grant access here. */
const requirePlatformAdmin = createMiddleware<AppEnv>(async (c, next) => {
  const token = getCookie(c, platformCookieName);
  const payload = token ? await verifyToken<PlatformTokenPayload>(c.env, token) : null;
  if (payload?.kind !== "platform") return c.json({ error: "Authentication required" }, 401);
  const admin = await c.get("db").query.platformAdmins.findFirst({
    where: and(eq(schema.platformAdmins.id, payload.adminId), eq(schema.platformAdmins.isActive, true)),
  });
  if (!admin) return c.json({ error: "Authentication required" }, 401);
  c.set("platformAdmin", admin);
  await next();
});

async function audit(
  db: Db,
  adminId: number,
  tenantId: number | null,
  action: string,
  detail?: Record<string, unknown>,
) {
  await db.insert(schema.platformAuditLog).values({ adminId, tenantId, action, detail: detail ?? null });
}

function publicAdmin(a: schema.PlatformAdmin) {
  return { id: a.id, email: a.email, name: a.name, isActive: a.isActive, lastLoginAt: a.lastLoginAt, createdAt: a.createdAt };
}

/** An unusable password hash: nobody can sign in until they set one through the setup link. */
async function lockedPasswordHash() {
  return hashPassword(crypto.randomUUID() + crypto.randomUUID());
}

async function findOwner(db: Db, tenant: schema.Tenant) {
  const owners = await db.query.tenantStaff.findMany({
    where: and(eq(schema.tenantStaff.tenantId, tenant.id), eq(schema.tenantStaff.role, "OWNER")),
  });
  return owners.find((o) => o.email === tenant.email) ?? owners[0] ?? null;
}

async function sendSetupEmail(env: Env, input: { to: string; name: string; companyName: string; url: string; adminName: string }) {
  const html = layout(
    `Your Wepilo workspace is ready`,
    `<p>Hi ${escapeHtml(input.name)},</p>
     <p>${escapeHtml(input.adminName)} from the Wepilo team set up a workspace for <strong>${escapeHtml(input.companyName)}</strong>. Choose a password to take it over.</p>
     <p style="margin:24px 0;"><a href="${input.url}" style="background:#15803d;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:600;">Set your password</a></p>
     <p style="color:#64748b;font-size:13px;">The link works once and expires in 7 days. Sign in afterwards with ${escapeHtml(input.to)}.</p>`,
  );
  return sendEmail({
    apiKey: env.RESEND_API_KEY,
    from: env.PLATFORM_EMAIL_FROM,
    to: input.to,
    subject: "Your Wepilo workspace is ready",
    html,
  });
}

const setupUrl = (env: Env, token: string) => `${env.DASHBOARD_URL}/setup-account?token=${token}`;

const futureDate = z.coerce
  .date()
  .refine((d) => d.getTime() > Date.now(), "must be in the future");

const createTenantSchema = z
  .object({
    companyName: z.string().trim().min(1),
    slug: z
      .string()
      .min(2)
      .max(60)
      .regex(/^[a-z0-9-]+$/, "lowercase letters, numbers and dashes only"),
    ownerName: z.string().trim().min(1),
    ownerEmail: z.string().email(),
    phone: z.string().optional(),
    website: z.string().url().optional().or(z.literal("")),
    plan: z.enum(PLAN_KEYS),
    /** Null = no end date (Enterprise only). */
    planExpiresAt: futureDate.nullable(),
    internalNotes: z.string().max(5000).optional(),
    sendSetupEmail: z.boolean().default(false),
  })
  .refine((v) => v.plan === "ENTERPRISE" || v.planExpiresAt, {
    path: ["planExpiresAt"],
    message: "an end date is required unless the plan is Enterprise",
  });

const updateTenantSchema = z.object({
  companyName: z.string().trim().min(1).optional(),
  ownerName: z.string().trim().min(1).optional(),
  ownerEmail: z.string().email().optional(),
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
  plan: z.enum(PLAN_KEYS).optional(),
  planExpiresAt: z.coerce.date().nullable().optional(),
  billingMode: z.enum(["SELF_SERVE", "MANUAL"]).optional(),
  internalNotes: z.string().max(5000).nullable().optional(),
});

async function tenantById(db: Db, id: number) {
  const tenant = await db.query.tenants.findFirst({ where: eq(schema.tenants.id, id) });
  if (!tenant) throw new ApiError(404, "Workspace not found");
  return tenant;
}

function tenantSummary(tenant: schema.Tenant, sub: schema.PlatformSubscription | null | undefined) {
  return {
    id: tenant.id,
    companyName: tenant.companyName,
    slug: tenant.slug,
    email: tenant.email,
    status: tenant.status,
    plan: tenant.plan,
    planExpiresAt: tenant.planExpiresAt,
    billingMode: tenant.billingMode,
    createdByAdminId: tenant.createdByAdminId,
    createdAt: tenant.createdAt,
    access: accessFor(tenant, sub),
    subscription: sub
      ? {
          status: sub.status,
          plan: sub.plan,
          interval: sub.interval,
          currentPeriodEnd: sub.currentPeriodEnd,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          hasPaidSubscription: Boolean(sub.dodoSubscriptionId),
        }
      : null,
  };
}

const platformAuthRoutes = new Hono<AppEnv>()
  .post("/login", async (c) => {
    const body = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(await c.req.json());
    const db = c.get("db");
    const admin = await db.query.platformAdmins.findFirst({
      where: eq(schema.platformAdmins.email, body.email.toLowerCase()),
    });
    if (!admin || !admin.isActive || !(await verifyPassword(body.password, admin.password))) {
      throw new ApiError(401, "Invalid email or password");
    }
    await db.update(schema.platformAdmins).set({ lastLoginAt: new Date() }).where(eq(schema.platformAdmins.id, admin.id));
    setPlatformAuthCookie(c, await signToken(c.env, { kind: "platform", adminId: admin.id }, "12h"));
    return c.json({ admin: publicAdmin(admin) });
  })
  .post("/logout", (c) => {
    clearPlatformAuthCookie(c);
    return c.json({ ok: true });
  })
  .get("/me", requirePlatformAdmin, (c) => c.json({ admin: publicAdmin(c.get("platformAdmin")!) }));

const platformTenantRoutes = new Hono<AppEnv>()
  .use("*", requirePlatformAdmin)
  .get("/", async (c) => {
    const { page, limit } = paginationSchema.parse(c.req.query());
    const search = c.req.query("search")?.trim();
    const db = c.get("db");
    const where = search
      ? or(
          like(schema.tenants.companyName, `%${search}%`),
          like(schema.tenants.slug, `%${search}%`),
          like(schema.tenants.email, `%${search}%`),
        )
      : undefined;
    const [rows, [total]] = await Promise.all([
      db.query.tenants.findMany({
        where,
        orderBy: desc(schema.tenants.createdAt),
        limit,
        offset: getOffset(page, limit),
      }),
      db.select({ value: count() }).from(schema.tenants).where(where),
    ]);
    const ids = rows.map((t) => t.id);
    const subs = ids.length
      ? await db.query.platformSubscriptions.findMany({ where: inArray(schema.platformSubscriptions.tenantId, ids) })
      : [];
    const subByTenant = new Map(subs.map((s) => [s.tenantId, s]));
    return c.json(paginate(rows.map((t) => tenantSummary(t, subByTenant.get(t.id))), page, limit, total.value));
  })
  .get("/overview", async (c) => {
    const db = c.get("db");
    const [tenants, subs] = await Promise.all([
      db.query.tenants.findMany({
        columns: { id: true, plan: true, planExpiresAt: true, trialUsedAt: true, billingMode: true, status: true },
      }),
      db.query.platformSubscriptions.findMany(),
    ]);
    const subByTenant = new Map(subs.map((s) => [s.tenantId, s]));
    const counts = { total: tenants.length, active: 0, trial: 0, locked: 0, managed: 0, suspended: 0 };
    for (const t of tenants) {
      const access = accessFor(t, subByTenant.get(t.id));
      if (t.status === "SUSPENDED") counts.suspended++;
      else if (access.locked) counts.locked++;
      else if (access.state === "TRIAL") counts.trial++;
      else counts.active++;
      if (t.billingMode === "MANUAL") counts.managed++;
    }
    return c.json(counts);
  })
  .post("/", async (c) => {
    const body = createTenantSchema.parse(await c.req.json());
    const db = c.get("db");
    const admin = c.get("platformAdmin")!;
    const email = body.ownerEmail.toLowerCase();
    const slug = slugify(body.slug);

    if (await db.query.tenants.findFirst({ where: eq(schema.tenants.slug, slug), columns: { id: true } })) {
      throw new ApiError(409, "Slug already taken", "SLUG_TAKEN");
    }
    if (await db.query.tenants.findFirst({ where: eq(schema.tenants.email, email), columns: { id: true } })) {
      throw new ApiError(409, "A workspace already uses this owner email", "EMAIL_TAKEN");
    }

    const passwordHash = await lockedPasswordHash();
    const now = new Date();
    const [tenant] = await db
      .insert(schema.tenants)
      .values({
        email,
        password: passwordHash,
        companyName: body.companyName,
        slug,
        phone: body.phone || null,
        website: body.website || null,
        status: "ACTIVE",
        plan: body.plan,
        planExpiresAt: body.planExpiresAt,
        billingMode: "MANUAL",
        // Hand-made workspaces don't get the self-serve $1 trial.
        trialUsedAt: now,
        internalNotes: body.internalNotes || null,
        createdByAdminId: admin.id,
      })
      .returning();

    const [owner] = await db
      .insert(schema.tenantStaff)
      .values({ tenantId: tenant.id, name: body.ownerName, email, password: passwordHash, role: "OWNER", permissions: [] })
      .returning();

    const { token, expiresAt } = await issueStaffToken(db, owner.id, "SETUP");
    const url = setupUrl(c.env, token);
    const emailSent = body.sendSetupEmail
      ? await sendSetupEmail(c.env, { to: email, name: body.ownerName, companyName: body.companyName, url, adminName: admin.name })
      : false;

    await audit(db, admin.id, tenant.id, "workspace.created", {
      plan: body.plan,
      planExpiresAt: body.planExpiresAt,
      ownerEmail: email,
      setupEmailSent: emailSent,
    });

    return c.json({ tenant: tenantSummary(tenant, null), setup: { url, expiresAt, emailSent } }, 201);
  })
  .get("/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const db = c.get("db");
    const tenant = await tenantById(db, id);
    const [sub, staff, [trips], [posts], [bookings], log, openSetup] = await Promise.all([
      db.query.platformSubscriptions.findFirst({ where: eq(schema.platformSubscriptions.tenantId, id) }),
      db.query.tenantStaff.findMany({ where: eq(schema.tenantStaff.tenantId, id), orderBy: schema.tenantStaff.id }),
      db.select({ value: count() }).from(schema.activities).where(eq(schema.activities.tenantId, id)),
      db
        .select({ value: count() })
        .from(schema.blogs)
        .where(and(eq(schema.blogs.tenantId, id), eq(schema.blogs.inTrash, false))),
      db.select({ value: count() }).from(schema.bookings).where(eq(schema.bookings.tenantId, id)),
      db.query.platformAuditLog.findMany({
        where: eq(schema.platformAuditLog.tenantId, id),
        orderBy: [desc(schema.platformAuditLog.createdAt), desc(schema.platformAuditLog.id)],
        limit: 50,
        with: { admin: { columns: { name: true, email: true } } },
      }),
      db
        .select({ expiresAt: schema.staffAuthTokens.expiresAt })
        .from(schema.staffAuthTokens)
        .innerJoin(schema.tenantStaff, eq(schema.tenantStaff.id, schema.staffAuthTokens.staffId))
        .where(
          and(
            eq(schema.tenantStaff.tenantId, id),
            eq(schema.tenantStaff.role, "OWNER"),
            eq(schema.staffAuthTokens.purpose, "SETUP"),
            sql`${schema.staffAuthTokens.usedAt} is null`,
            sql`${schema.staffAuthTokens.expiresAt} > ${Date.now()}`,
          ),
        )
        .limit(1),
    ]);
    const owner = staff.find((s) => s.role === "OWNER" && s.email === tenant.email) ?? staff.find((s) => s.role === "OWNER");
    return c.json({
      tenant: {
        ...tenantSummary(tenant, sub),
        phone: tenant.phone,
        website: tenant.website,
        internalNotes: tenant.internalNotes,
        trialUsedAt: tenant.trialUsedAt,
      },
      owner: owner ? { id: owner.id, name: owner.name, email: owner.email } : null,
      /** Expiry of the owner's open setup link, if one is waiting to be used. */
      pendingSetupUntil: openSetup[0]?.expiresAt ?? null,
      staff: staff.map((s) => ({ id: s.id, name: s.name, email: s.email, role: s.role, isActive: s.isActive, createdAt: s.createdAt })),
      usage: { trips: trips.value, posts: posts.value, bookings: bookings.value, staff: staff.length },
      log: log.map((l) => ({ id: l.id, action: l.action, detail: l.detail, createdAt: l.createdAt, admin: l.admin })),
    });
  })
  .patch("/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const body = updateTenantSchema.parse(await c.req.json());
    const db = c.get("db");
    const admin = c.get("platformAdmin")!;
    const tenant = await tenantById(db, id);
    const now = new Date();

    const nextPlan = body.plan ?? tenant.plan;
    const nextExpiry = body.planExpiresAt !== undefined ? body.planExpiresAt : tenant.planExpiresAt;
    const touchesPlan = body.plan !== undefined || body.planExpiresAt !== undefined;
    if (touchesPlan && nextPlan !== "ENTERPRISE" && !nextExpiry) {
      throw new ApiError(400, "planExpiresAt: an end date is required unless the plan is Enterprise", "VALIDATION");
    }

    const set: Partial<typeof schema.tenants.$inferInsert> = { updatedAt: now };
    if (body.companyName !== undefined) set.companyName = body.companyName;
    if (body.status !== undefined) set.status = body.status;
    if (body.internalNotes !== undefined) set.internalNotes = body.internalNotes || null;
    if (touchesPlan) {
      set.plan = nextPlan;
      set.planExpiresAt = nextExpiry;
      set.billingMode = "MANUAL";
      // Re-arm the "access ended" email when access is extended.
      if (!nextExpiry || nextExpiry.getTime() > now.getTime()) set.expiryNoticeSentAt = null;
    }
    if (body.billingMode !== undefined && !touchesPlan) set.billingMode = body.billingMode;

    const owner = await findOwner(db, tenant);
    if (body.ownerEmail !== undefined) {
      const email = body.ownerEmail.toLowerCase();
      if (email !== tenant.email) {
        const taken = await db.query.tenants.findFirst({ where: eq(schema.tenants.email, email), columns: { id: true } });
        if (taken) throw new ApiError(409, "A workspace already uses this owner email", "EMAIL_TAKEN");
        const staffTaken = await db.query.tenantStaff.findFirst({
          where: and(eq(schema.tenantStaff.tenantId, id), eq(schema.tenantStaff.email, email)),
          columns: { id: true },
        });
        if (staffTaken && staffTaken.id !== owner?.id) throw new ApiError(409, "Another staff member in this workspace uses this email");
        set.email = email;
      }
    }

    await db.update(schema.tenants).set(set).where(eq(schema.tenants.id, id));
    if (owner && (set.email || body.ownerName)) {
      await db
        .update(schema.tenantStaff)
        .set({ ...(set.email ? { email: set.email } : {}), ...(body.ownerName ? { name: body.ownerName } : {}), updatedAt: now })
        .where(eq(schema.tenantStaff.id, owner.id));
    }

    const changes = Object.fromEntries(
      Object.entries(body).filter(([k]) => k !== "internalNotes"),
    );
    if (body.internalNotes !== undefined) changes.internalNotes = "(updated)";
    await audit(db, admin.id, id, "workspace.updated", changes);
    return c.json({ ok: true });
  })
  // New setup link for the owner (the old one stops working). Use it to hand over, or to re-send.
  .post("/:id/setup-link", async (c) => {
    const id = Number(c.req.param("id"));
    const body = z.object({ sendEmail: z.boolean().default(false) }).parse(await c.req.json().catch(() => ({})));
    const db = c.get("db");
    const admin = c.get("platformAdmin")!;
    const tenant = await tenantById(db, id);
    const owner = await findOwner(db, tenant);
    if (!owner) throw new ApiError(409, "This workspace has no owner login");

    const { token, expiresAt } = await issueStaffToken(db, owner.id, "SETUP");
    const url = setupUrl(c.env, token);
    const emailSent = body.sendEmail
      ? await sendSetupEmail(c.env, {
          to: owner.email,
          name: owner.name,
          companyName: tenant.companyName ?? tenant.slug,
          url,
          adminName: admin.name,
        })
      : false;
    await audit(db, admin.id, id, "workspace.setup_link", { to: owner.email, emailSent });
    return c.json({ url, expiresAt, emailSent });
  })
  // Sign this browser into the workspace as its owner for an hour, e.g. to prepare content before handover.
  .post("/:id/impersonate", async (c) => {
    const id = Number(c.req.param("id"));
    const db = c.get("db");
    const admin = c.get("platformAdmin")!;
    const tenant = await tenantById(db, id);
    if (tenant.status === "SUSPENDED") throw new ApiError(409, "Reactivate the workspace first");
    const owner = await findOwner(db, tenant);
    if (!owner) throw new ApiError(409, "This workspace has no owner login");

    const token = await signToken(
      c.env,
      { kind: "staff", staffId: owner.id, tenantId: id, role: "OWNER", impersonatedBy: admin.id },
      `${IMPERSONATION_SECONDS}s`,
    );
    setStaffAuthCookie(c, token, IMPERSONATION_SECONDS);
    await audit(db, admin.id, id, "workspace.opened_as_owner");
    return c.json({ ok: true });
  });

const platformAdminRoutes = new Hono<AppEnv>()
  .use("*", requirePlatformAdmin)
  .get("/", async (c) => {
    const admins = await c.get("db").query.platformAdmins.findMany({ orderBy: schema.platformAdmins.id });
    return c.json({ admins: admins.map(publicAdmin) });
  })
  .post("/", async (c) => {
    const body = z
      .object({ name: z.string().trim().min(1), email: z.string().email(), password: z.string().min(12) })
      .parse(await c.req.json());
    const db = c.get("db");
    const email = body.email.toLowerCase();
    if (await db.query.platformAdmins.findFirst({ where: eq(schema.platformAdmins.email, email), columns: { id: true } })) {
      throw new ApiError(409, "An admin with this email already exists");
    }
    const [admin] = await db
      .insert(schema.platformAdmins)
      .values({ name: body.name, email, password: await hashPassword(body.password) })
      .returning();
    await audit(db, c.get("platformAdmin")!.id, null, "admin.created", { email });
    return c.json({ admin: publicAdmin(admin) }, 201);
  })
  .patch("/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const body = z
      .object({ name: z.string().trim().min(1).optional(), isActive: z.boolean().optional(), password: z.string().min(12).optional() })
      .parse(await c.req.json());
    const db = c.get("db");
    const me = c.get("platformAdmin")!;
    if (id === me.id && body.isActive === false) throw new ApiError(400, "You can't deactivate yourself");
    const target = await db.query.platformAdmins.findFirst({ where: eq(schema.platformAdmins.id, id) });
    if (!target) throw new ApiError(404, "Admin not found");
    await db
      .update(schema.platformAdmins)
      .set({
        ...(body.name ? { name: body.name } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        ...(body.password ? { password: await hashPassword(body.password) } : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.platformAdmins.id, id));
    await audit(db, me.id, null, "admin.updated", {
      email: target.email,
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      ...(body.password ? { password: "(changed)" } : {}),
    });
    return c.json({ ok: true });
  });

export const platformRoutes = new Hono<AppEnv>()
  .route("/auth", platformAuthRoutes)
  .route("/tenants", platformTenantRoutes)
  .route("/admins", platformAdminRoutes);
