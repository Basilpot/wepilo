import { Hono } from "hono";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import * as schema from "@/db/schema";
import { loadAccess } from "@/lib/billing";
import type { AppEnv } from "@/types";
import { ApiError, slugify } from "@/lib/http";
import {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  type TokenPayload,
  setStaffAuthCookie,
  setUserAuthCookie,
  clearAuthCookies,
} from "@/lib/auth";
import { requireStaff, requireUser } from "@/middleware/context";
import { sendEmail, layout, escapeHtml } from "@/lib/email";

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
});

export const authRoutes = new Hono<AppEnv>()
  .post("/tenant/signup", async (c) => {
    const body = signupSchema.parse(await c.req.json());
    const db = c.get("db");

    const existing = await db.query.tenants.findFirst({
      where: eq(schema.tenants.slug, body.slug),
    });
    if (existing) throw new ApiError(409, "Slug already taken", "SLUG_TAKEN");

    const existingEmail = await db.query.tenants.findFirst({
      where: eq(schema.tenants.email, body.email.toLowerCase()),
    });
    if (existingEmail) throw new ApiError(409, "Email already registered", "EMAIL_TAKEN");

    const passwordHash = await hashPassword(body.password);

    const [tenant] = await db
      .insert(schema.tenants)
      .values({
        email: body.email.toLowerCase(),
        password: passwordHash,
        companyName: body.companyName,
        slug: slugify(body.slug),
        phone: body.phone || null,
        website: body.website || null,
        status: "ACTIVE",
        plan: "STARTER",
        // No access until the $1 trial (or a plan) is paid.
        planExpiresAt: null,
      })
      .returning();

    await db.insert(schema.tenantStaff).values({
      tenantId: tenant.id,
      name: body.companyName,
      email: body.email.toLowerCase(),
      password: passwordHash,
      role: "OWNER",
      permissions: [],
    });

    const owner = await db.query.tenantStaff.findFirst({
      where: and(eq(schema.tenantStaff.tenantId, tenant.id), eq(schema.tenantStaff.role, "OWNER")),
    });
    const staffToken = await signToken(c.env, {
      kind: "staff",
      staffId: owner!.id,
      tenantId: tenant.id,
      role: "OWNER",
    });

    setStaffAuthCookie(c, staffToken);
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
  .post("/tenant/login", async (c) => {
    const body = loginSchema.parse(await c.req.json());
    const db = c.get("db");
    const tenant = await db.query.tenants.findFirst({
      where: eq(schema.tenants.email, body.email.toLowerCase()),
    });
    if (!tenant || !(await verifyPassword(body.password, tenant.password))) {
      throw new ApiError(401, "Invalid email or password");
    }
    if (tenant.status === "SUSPENDED") throw new ApiError(403, "Account suspended");

    const owner = await db.query.tenantStaff.findFirst({
      where: and(eq(schema.tenantStaff.tenantId, tenant.id), eq(schema.tenantStaff.role, "OWNER")),
    });
    const token = await signToken(c.env, {
      kind: "staff",
      staffId: owner?.id ?? tenant.id,
      tenantId: tenant.id,
      role: "OWNER",
    });
    setStaffAuthCookie(c, token);
    return c.json({
      tenant: {
        id: tenant.id,
        email: tenant.email,
        companyName: tenant.companyName,
        slug: tenant.slug,
        plan: tenant.plan,
        status: tenant.status,
      },
    });
  })
  .post("/staff/login", async (c) => {
    const body = loginSchema.parse(await c.req.json());
    const db = c.get("db");
    const staff = await db.query.tenantStaff.findFirst({
      where: eq(schema.tenantStaff.email, body.email.toLowerCase()),
    });
    if (!staff || !staff.isActive || !(await verifyPassword(body.password, staff.password))) {
      throw new ApiError(401, "Invalid email or password");
    }
    const token = await signToken(c.env, {
      kind: "staff",
      staffId: staff.id,
      tenantId: staff.tenantId,
      role: staff.role,
    });
    setStaffAuthCookie(c, token);
    return c.json({
      staff: {
        id: staff.id,
        name: staff.name,
        email: staff.email,
        role: staff.role,
        tenantId: staff.tenantId,
      },
    });
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
    return c.json({
      staff: {
        id: staff.id,
        name: staff.name,
        email: staff.email,
        role: staff.role,
      },
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
          }
        : null,
      access: tenant ? (await loadAccess(db, tenant.id))?.access ?? null : null,
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
    const staff = await db.query.tenantStaff.findFirst({
      where: eq(schema.tenantStaff.email, body.email.toLowerCase()),
    });
    if (!staff) return c.json({ ok: true });

    const token = await signToken(c.env, {
      kind: "staff",
      staffId: staff.id,
      tenantId: staff.tenantId,
      role: staff.role,
    });
    const resetUrl = `${c.env.DASHBOARD_URL}/reset-password?token=${token}`;
    await sendEmail({
      apiKey: c.env.RESEND_API_KEY,
      from: c.env.PLATFORM_EMAIL_FROM,
      to: staff.email,
      subject: "Reset your Narfu password",
      html: layout(
        "Password reset",
        `<p>Hi ${escapeHtml(staff.name)},</p><p>Use the link below to reset your password. It expires in 1 hour.</p><p><a href="${resetUrl}">Reset password</a></p>`,
      ),
    });
    return c.json({ ok: true });
  })
  .post("/reset-password", async (c) => {
    const body = z
      .object({ token: z.string(), password: z.string().min(8) })
      .parse(await c.req.json());
    const db = c.get("db");
    const decoded = await verifyToken<TokenPayload>(c.env, body.token);
    if (!decoded || decoded.kind !== "staff") throw new ApiError(400, "Invalid or expired token");
    const passwordHash = await hashPassword(body.password);
    await db
      .update(schema.tenantStaff)
      .set({ password: passwordHash, updatedAt: new Date() })
      .where(eq(schema.tenantStaff.id, decoded.staffId));
    return c.json({ ok: true });
  })
  .get("/authors/:username", async (c) => {
    const tenantId = c.get("tenantId");
    const db = c.get("db");
    const author = await db.query.authors.findFirst({
      where: and(
        eq(schema.authors.tenantId, tenantId),
        eq(schema.authors.username, c.req.param("username")),
      ),
    });
    if (!author) throw new ApiError(404, "Author not found");
    return c.json({ author: { id: author.id, username: author.username, name: author.name, bio: author.bio, image: author.image } });
  });
