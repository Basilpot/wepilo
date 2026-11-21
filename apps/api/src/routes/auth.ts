import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import { and, asc, eq, inArray } from "drizzle-orm";
import * as schema from "@/db/schema";
import { loadAccessForTrial } from "@/lib/billing";
import type { AppEnv } from "@/types";
import { ApiError, slugify } from "@/lib/http";
import {
  hashPassword,
  verifyPassword,
  signToken,
  setStaffAuthCookie,
  setUserAuthCookie,
  clearAuthCookies,
} from "@/lib/auth";
import { requireStaff, requireUser } from "@/middleware/context";
import { sendEmail, layout, escapeHtml } from "@/lib/email";
import { enforce, clientIp, LIMITS } from "@/lib/rate-limit";
import { issueStaffToken, consumeStaffToken, peekStaffToken } from "@/lib/staff-tokens";
import { hasAccount, membershipsFor, workspacesFor } from "@/lib/account";

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  companyName: z.string().min(1),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "lowercase letters, numbers and dashes only"),
  phone: z.string().optional(),
  website: z.string().url().optional().or(z.literal("")),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  /** Which workspace to open. Optional: the first one the person belongs to is used. */
  tenantId: z.coerce.number().int().optional(),
});

const workspaceSchema = z.object({
  companyName: z.string().trim().min(1).max(120),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "lowercase letters, numbers and dashes only"),
  phone: z.string().trim().max(40).optional(),
  website: z.string().url().optional().or(z.literal("")),
});

/** The session cookie for one membership. The session always belongs to a single workspace. */
function staffSession(c: Context<AppEnv>, staff: schema.TenantStaff) {
  return signToken(c.env, {
    kind: "staff",
    staffId: staff.id,
    tenantId: staff.tenantId,
    role: staff.role,
  });
}

export const authRoutes = new Hono<AppEnv>()
  // One sign-in for the whole account. The person may hold logins in several workspaces;
  // the password is theirs, whichever workspace they are opening.
  .post("/login", async (c) => {
    const body = loginSchema.parse(await c.req.json());
    const db = c.get("db");
    const email = body.email.toLowerCase();
    await enforce(db, LIMITS.login, `${clientIp(c)}:${email}`);

    const rows = await membershipsFor(db, email);
    const active = rows.filter((r) => r.isActive);
    if (!active.length) {
      // The workspace exists but its owner login is gone. Say so, rather than "wrong password".
      const workspace = await db.query.tenants.findFirst({ where: eq(schema.tenants.email, email), columns: { id: true } });
      if (workspace) throw new ApiError(409, "This workspace has no owner login. Contact Wepilo support.");
      throw new ApiError(401, "Invalid email or password");
    }

    // The password is shared by every one of their logins, so any of them can hold it.
    let matches = false;
    for (const row of active) {
      if (await verifyPassword(body.password, row.password)) {
        matches = true;
        break;
      }
    }
    if (!matches) throw new ApiError(401, "Invalid email or password");

    // A suspended workspace is not one to open, but it doesn't stop the person signing in.
    const tenants = await db.query.tenants.findMany({
      where: inArray(schema.tenants.id, [...new Set(active.map((r) => r.tenantId))]),
    });
    const statusByTenant = new Map(tenants.map((t) => [t.id, t.status]));
    const usable = active.filter((r) => statusByTenant.get(r.tenantId) && statusByTenant.get(r.tenantId) !== "SUSPENDED");
    if (!usable.length) throw new ApiError(403, "Account suspended");

    // Open the workspace they asked for, as long as they belong to it.
    let staff = usable[0];
    if (body.tenantId) staff = usable.find((r) => r.tenantId === body.tenantId) ?? staff;

    const tenant = await db.query.tenants.findFirst({ where: eq(schema.tenants.id, staff.tenantId) });
    if (!tenant) throw new ApiError(404, "That workspace no longer exists.");
    if (tenant.status === "SUSPENDED") throw new ApiError(403, "Account suspended");

    setStaffAuthCookie(c, await staffSession(c, staff));
    return c.json({
      staff: { id: staff.id, name: staff.name, email: staff.email, role: staff.role },
      tenant: { id: tenant.id, companyName: tenant.companyName, slug: tenant.slug },
      workspaces: await workspacesFor(db, email),
    });
  })
  // Open another workspace the person belongs to.
  .post("/switch", requireStaff(), async (c) => {
    const body = z.object({ tenantId: z.coerce.number().int() }).parse(await c.req.json());
    const db = c.get("db");
    const me = c.get("staff")!;
    const staff = await db.query.tenantStaff.findFirst({
      where: and(
        eq(schema.tenantStaff.email, me.email),
        eq(schema.tenantStaff.tenantId, body.tenantId),
        eq(schema.tenantStaff.isActive, true),
      ),
    });
    if (!staff) throw new ApiError(403, "You are not a member of that workspace.", "NOT_A_MEMBER");
    const tenant = await db.query.tenants.findFirst({ where: eq(schema.tenants.id, staff.tenantId) });
    if (!tenant) throw new ApiError(404, "That workspace no longer exists.");
    if (tenant.status === "SUSPENDED") throw new ApiError(403, "That workspace is suspended.");

    setStaffAuthCookie(c, await staffSession(c, staff));
    return c.json({ ok: true, tenant: { id: tenant.id, slug: tenant.slug, companyName: tenant.companyName } });
  })
  // Add another workspace to the person's account.
  .post("/workspaces", requireStaff(), async (c) => {
    const body = workspaceSchema.parse(await c.req.json());
    const db = c.get("db");
    const me = c.get("staff")!;
    await enforce(db, LIMITS.account, clientIp(c));
    const slug = slugify(body.slug);
    if (!slug) throw new ApiError(400, "Choose a web address for your workspace.", "VALIDATION");
    if (await db.query.tenants.findFirst({ where: eq(schema.tenants.slug, slug) })) {
      throw new ApiError(409, "That web address is already taken. Try another one.", "SLUG_TAKEN");
    }

    const [tenant] = await db
      .insert(schema.tenants)
      .values({
        email: me.email,
        companyName: body.companyName,
        slug,
        phone: body.phone || null,
        website: body.website || null,
        status: "ACTIVE",
        plan: "PRO",
        // No access until a plan is paid for. The free trial is one per person.
        planExpiresAt: null,
        billingMode: "SELF_SERVE",
      })
      .returning();

    // The owner keeps the same password: one password per person.
    const [owner] = await db
      .insert(schema.tenantStaff)
      .values({
        tenantId: tenant.id,
        name: body.companyName,
        email: me.email,
        password: me.password,
        role: "OWNER",
        permissions: [],
      })
      .returning();

    setStaffAuthCookie(c, await staffSession(c, owner));
    return c.json(
      { tenant: { id: tenant.id, companyName: tenant.companyName, slug: tenant.slug }, workspaces: await workspacesFor(db, me.email) },
      201,
    );
  })
  .post("/tenant/signup", async (c) => {
    const body = signupSchema.parse(await c.req.json());
    const db = c.get("db");
    await enforce(db, LIMITS.account, clientIp(c));

    const existing = await db.query.tenants.findFirst({
      where: eq(schema.tenants.slug, body.slug),
    });
    if (existing) throw new ApiError(409, "Slug already taken", "SLUG_TAKEN");

    const email = body.email.toLowerCase();
    // One person, one account. A second workspace is added after signing in.
    if (await hasAccount(db, email)) {
      throw new ApiError(409, "You already have a Wepilo account. Sign in and add another workspace.", "EMAIL_TAKEN");
    }

    const passwordHash = await hashPassword(body.password);

    const [tenant] = await db
      .insert(schema.tenants)
      .values({
        email,
        companyName: body.companyName,
        slug: slugify(body.slug),
        phone: body.phone || null,
        website: body.website || null,
        status: "ACTIVE",
        plan: "PRO",
        // No access until the $2.99 trial (or a plan) is paid.
        planExpiresAt: null,
      })
      .returning();

    const [owner] = await db
      .insert(schema.tenantStaff)
      .values({
        tenantId: tenant.id,
        name: body.companyName,
        email,
        password: passwordHash,
        role: "OWNER",
        permissions: [],
      })
      .returning();

    setStaffAuthCookie(c, await staffSession(c, owner));
    return c.json(
      {
        tenant: {
          id: tenant.id,
          email: tenant.email,
          companyName: tenant.companyName,
          slug: tenant.slug,
          plan: tenant.plan,
          status: tenant.status,
        },
      },
      201,
    );
  })
  .post("/logout", (c) => {
    clearAuthCookies(c);
    return c.json({ ok: true });
  })
  .post("/users/register", async (c) => {
    const body = z
      .object({
        name: z.string().min(1),
        email: z.string().email(),
        username: z.string().min(3).max(40),
        password: z.string().min(8),
      })
      .parse(await c.req.json());
    const tenantId = c.get("tenantId");
    if (!tenantId) throw new ApiError(400, "Tenant context required");
    const db = c.get("db");
    await enforce(db, LIMITS.account, `${tenantId}:${clientIp(c)}`);

    const existing = await db.query.users.findFirst({
      where: and(eq(schema.users.tenantId, tenantId), eq(schema.users.email, body.email.toLowerCase())),
    });
    if (existing) throw new ApiError(409, "Email already registered");

    const [user] = await db
      .insert(schema.users)
      .values({
        tenantId,
        name: body.name,
        email: body.email.toLowerCase(),
        username: body.username.toLowerCase(),
        password: await hashPassword(body.password),
        emailVerified: false,
      })
      .returning();

    const token = await signToken(c.env, { kind: "user", userId: user.id, tenantId });
    setUserAuthCookie(c, token);
    return c.json({ user: { id: user.id, name: user.name, email: user.email, username: user.username } }, 201);
  })
  .post("/users/login", async (c) => {
    const body = loginSchema.parse(await c.req.json());
    const tenantId = c.get("tenantId");
    if (!tenantId) throw new ApiError(400, "Tenant context required");
    const db = c.get("db");
    await enforce(db, LIMITS.login, `${tenantId}:${clientIp(c)}:${body.email.toLowerCase()}`);
    const user = await db.query.users.findFirst({
      where: and(eq(schema.users.tenantId, tenantId), eq(schema.users.email, body.email.toLowerCase())),
    });
    if (!user || !(await verifyPassword(body.password, user.password))) {
      throw new ApiError(401, "Invalid email or password");
    }
    const token = await signToken(c.env, { kind: "user", userId: user.id, tenantId });
    setUserAuthCookie(c, token);
    return c.json({ user: { id: user.id, name: user.name, email: user.email, username: user.username } });
  })
  .get("/me", requireStaff(), async (c) => {
    const staff = c.get("staff")!;
    const db = c.get("db");
    const tenant = await db.query.tenants.findFirst({
      where: eq(schema.tenants.id, staff.tenantId),
    });
    const paymentSettings = await db.query.tenantPaymentSettings.findFirst({
      where: eq(schema.tenantPaymentSettings.tenantId, staff.tenantId),
      columns: { currency: true, currencyTranslation: true },
    });
    return c.json({
      staff: {
        id: staff.id,
        name: staff.name,
        email: staff.email,
        role: staff.role,
      },
      impersonatedBy: c.get("impersonatedBy"),
      tenant: tenant
        ? {
            id: tenant.id,
            email: tenant.email,
            companyName: tenant.companyName,
            companyLogo: tenant.companyLogo,
            website: tenant.website,
            companyDescription: tenant.companyDescription,
            phone: tenant.phone,
            address: tenant.address,
            slug: tenant.slug,
            status: tenant.status,
            plan: tenant.plan,
            planExpiresAt: tenant.planExpiresAt,
            currency: paymentSettings?.currency ?? "USD",
            currencyTranslation: paymentSettings?.currencyTranslation ?? false,
          }
        : null,
      access: tenant ? (await loadAccessForTrial(db, tenant.id))?.access ?? null : null,
      /** Every workspace this person can open. */
      workspaces: await workspacesFor(db, staff.email),
    });
  })
  .get("/users/me", requireUser(), (c) => {
    const user = c.get("user")!;
    return c.json({
      user: { id: user.id, name: user.name, email: user.email, username: user.username },
    });
  })
  .post("/forget-password", async (c) => {
    const body = z.object({ email: z.string().email() }).parse(await c.req.json());
    const db = c.get("db");
    await enforce(db, LIMITS.account, `reset:${clientIp(c)}`);
    const staff = await db.query.tenantStaff.findFirst({
      where: and(eq(schema.tenantStaff.email, body.email.toLowerCase()), eq(schema.tenantStaff.isActive, true)),
      orderBy: [asc(schema.tenantStaff.id)],
    });
    if (!staff) return c.json({ ok: true });

    const { token } = await issueStaffToken(db, staff.id, "RESET");
    const resetUrl = `${c.env.DASHBOARD_URL}/reset-password?token=${token}`;
    await sendEmail({
      apiKey: c.env.RESEND_API_KEY,
      from: c.env.PLATFORM_EMAIL_FROM,
      to: staff.email,
      subject: "Reset your Wepilo password",
      html: layout(
        "Password reset",
        `<p>Hi ${escapeHtml(staff.name)},</p><p>Use the link below to reset your password. It expires in 1 hour and works once. It applies to every workspace you can sign in to.</p><p><a href="${resetUrl}">Reset password</a></p>`,
      ),
    });
    return c.json({ ok: true });
  })
  // What a setup/reset link is for, so the page can greet the person. 404 when the link is dead.
  .get("/link-info", async (c) => {
    const token = c.req.query("token") ?? "";
    const db = c.get("db");
    const found = token ? await peekStaffToken(db, token) : null;
    if (!found) throw new ApiError(404, "This link has expired or was already used.", "LINK_INVALID");
    const tenant = await db.query.tenants.findFirst({
      where: eq(schema.tenants.id, found.staff.tenantId),
      columns: { companyName: true },
    });
    return c.json({
      purpose: found.row.purpose,
      email: found.staff.email,
      name: found.staff.name,
      companyName: tenant?.companyName ?? null,
    });
  })
  .post("/reset-password", async (c) => {
    const body = z
      .object({ token: z.string().min(1), password: z.string().min(8) })
      .parse(await c.req.json());
    const db = c.get("db");
    await enforce(db, LIMITS.login, `reset-token:${clientIp(c)}`);
    const used = await consumeStaffToken(db, body.token, await hashPassword(body.password));
    if (!used) throw new ApiError(400, "This link has expired or was already used.", "LINK_INVALID");
    return c.json({ ok: true, email: used.staff.email });
  })
  .get("/authors/:username", async (c) => {
    const tenantId = c.get("tenantId");
    const db = c.get("db");
    const author = await db.query.tenantStaff.findFirst({
      where: and(
        eq(schema.tenantStaff.tenantId, tenantId),
        eq(schema.tenantStaff.username, c.req.param("username")),
        eq(schema.tenantStaff.isActive, true),
      ),
    });
    if (!author) throw new ApiError(404, "Author not found");
    return c.json({ author: { id: author.id, username: author.username, name: author.name, bio: author.bio, image: author.image } });
  });
