import { Hono } from "hono";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AppEnv } from "@/types";
import { ApiError } from "@/lib/http";
import { requireStaff, requireTenant } from "@/middleware/context";
import { readSiteConfig, resolveHomepage, resolveNavigation, siteConfigSchema } from "@/lib/site";

/** Everything a website needs for its shell and homepage, in one cacheable request. */
export const siteRoutes = new Hono<AppEnv>()
  .get("/", requireTenant(), async (c) => {
    const db = c.get("db");
    const tenantId = c.get("tenantId");
    const tenant = await db.query.tenants.findFirst({
      where: eq(schema.tenants.id, tenantId),
      columns: { companyName: true, companyLogo: true, companyDescription: true, phone: true, address: true, website: true, email: true, siteConfig: true },
    });
    if (!tenant) throw new ApiError(404, "Not found");
    const config = readSiteConfig(tenant.siteConfig);
    const [navigation, homepage] = await Promise.all([resolveNavigation(db, tenantId, config), resolveHomepage(db, tenantId, config)]);
    return c.json(
      {
        company: {
          name: tenant.companyName,
          logo: tenant.companyLogo,
          description: tenant.companyDescription,
          phone: tenant.phone,
          address: tenant.address,
          website: tenant.website,
          email: tenant.email,
        },
        seo: config.seo,
        social: config.social,
        announcement: config.announcement.enabled && config.announcement.text ? config.announcement : null,
        navigation,
        homepage,
      },
      200,
      { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
    );
  })
  .get("/config", requireStaff(), requireTenant(), async (c) => {
    const tenant = await c.get("db").query.tenants.findFirst({
      where: eq(schema.tenants.id, c.get("tenantId")),
      columns: { siteConfig: true },
    });
    return c.json({ config: readSiteConfig(tenant?.siteConfig) });
  })
  .put("/config", requireStaff("OWNER", "ADMIN", "MANAGER"), requireTenant(), async (c) => {
    const config = siteConfigSchema.parse(await c.req.json());
    const ids = config.homepage.sections.map((s) => s.id);
    if (new Set(ids).size !== ids.length) throw new ApiError(400, "homepage.sections: each section needs its own id", "VALIDATION");
    const db = c.get("db");
    await db.update(schema.tenants).set({ siteConfig: config, updatedAt: new Date() }).where(eq(schema.tenants.id, c.get("tenantId")));
    return c.json({ config });
  });

// ── Reusable editor content ──────────────────────────────────────────────────

const nameSchema = z.string().trim().min(1).max(120);

export const savedSectionRoutes = new Hono<AppEnv>()
  .use("*", requireStaff(), requireTenant())
  .get("/", async (c) => {
    const rows = await c.get("db").query.savedSections.findMany({
      where: eq(schema.savedSections.tenantId, c.get("tenantId")),
      orderBy: [desc(schema.savedSections.createdAt)],
      limit: 200,
    });
    return c.json({ data: rows });
  })
  .post("/", async (c) => {
    const body = z.object({ name: nameSchema, data: z.record(z.unknown()) }).parse(await c.req.json());
    if (JSON.stringify(body.data).length > 100_000) throw new ApiError(413, "That section is too large to save.");
    const [row] = await c.get("db").insert(schema.savedSections).values({ tenantId: c.get("tenantId"), name: body.name, data: body.data }).returning();
    return c.json({ section: row }, 201);
  })
  .patch("/:id", async (c) => {
    const body = z.object({ name: nameSchema }).parse(await c.req.json());
    const [row] = await c
      .get("db")
      .update(schema.savedSections)
      .set({ name: body.name, updatedAt: new Date() })
      .where(and(eq(schema.savedSections.id, Number(c.req.param("id"))), eq(schema.savedSections.tenantId, c.get("tenantId"))))
      .returning();
    if (!row) throw new ApiError(404, "Saved section not found");
    return c.json({ section: row });
  })
  .delete("/:id", async (c) => {
    await c.get("db").delete(schema.savedSections).where(and(eq(schema.savedSections.id, Number(c.req.param("id"))), eq(schema.savedSections.tenantId, c.get("tenantId"))));
    return c.json({ ok: true });
  });

export const templateRoutes = new Hono<AppEnv>()
  .use("*", requireStaff(), requireTenant())
  .get("/", async (c) => {
    const rows = await c.get("db").query.editorTemplates.findMany({
      where: eq(schema.editorTemplates.tenantId, c.get("tenantId")),
      orderBy: [desc(schema.editorTemplates.createdAt)],
      limit: 200,
    });
    return c.json({ data: rows });
  })
  .post("/", async (c) => {
    const body = z.object({ name: nameSchema, content: z.string().min(1).max(200_000) }).parse(await c.req.json());
    const [row] = await c.get("db").insert(schema.editorTemplates).values({ tenantId: c.get("tenantId"), ...body }).returning();
    return c.json({ template: row }, 201);
  })
  .patch("/:id", async (c) => {
    const body = z.object({ name: nameSchema.optional(), content: z.string().min(1).max(200_000).optional() }).parse(await c.req.json());
    const [row] = await c
      .get("db")
      .update(schema.editorTemplates)
      .set({ ...body, updatedAt: new Date() })
      .where(and(eq(schema.editorTemplates.id, Number(c.req.param("id"))), eq(schema.editorTemplates.tenantId, c.get("tenantId"))))
      .returning();
    if (!row) throw new ApiError(404, "Template not found");
    return c.json({ template: row });
  })
  .delete("/:id", async (c) => {
    await c.get("db").delete(schema.editorTemplates).where(and(eq(schema.editorTemplates.id, Number(c.req.param("id"))), eq(schema.editorTemplates.tenantId, c.get("tenantId"))));
    return c.json({ ok: true });
  });
