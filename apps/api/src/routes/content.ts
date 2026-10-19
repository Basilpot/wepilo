import { Hono } from "hono";
import { z } from "zod";
import { eq, and, desc, like, or, count, sql, inArray } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AppEnv } from "@/types";
import { ApiError, slugify, paginate, paginationSchema } from "@/lib/http";
import { requireStaff, requireTenant, assertPlanLimit, tenantLimits } from "@/middleware/context";
import { deleteObject, getObject, mediaKey, putObject } from "@/lib/storage";

// ── Blogs ────────────────────────────────────────────────────────────────────

const blogBaseSchema = z.object({
  title: z.string().min(1),
  slug: z.string().optional(),
  content: z.string().nullable().optional(),
  coverImage: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  published: z.boolean().optional(),
  postType: z.enum(["BLOG", "TRAVEL_GUIDE"]).optional(),
  metaTitle: z.string().nullable().optional(),
  metaDescription: z.string().nullable().optional(),
  canonicalUrl: z.string().nullable().optional(),
  cityId: z.number().int().nullable().optional(),
  writerId: z.number().int().nullable().optional(),
  blogCategoryId: z.number().int().nullable().optional(),
  translations: z.record(z.string(), z.any()).optional(),
});

export const blogRoutes = new Hono<AppEnv>()
  .get("/", requireStaff(), requireTenant(), async (c) => {
    const db = c.get("db");
    const q = paginationSchema
      .extend({
        search: z.string().optional(),
        published: z.enum(["true", "false"]).optional(),
        trashed: z.enum(["true", "false"]).optional(),
        categoryId: z.coerce.number().int().optional(),
      })
      .parse(c.req.query());
    const conditions = [eq(schema.blogs.tenantId, c.get("tenantId"))];
    if (q.trashed !== "true") conditions.push(eq(schema.blogs.inTrash, false));
    else conditions.push(eq(schema.blogs.inTrash, true));
    if (q.published === "true") conditions.push(eq(schema.blogs.published, true));
    if (q.published === "false") conditions.push(eq(schema.blogs.published, false));
    if (q.categoryId) conditions.push(eq(schema.blogs.blogCategoryId, q.categoryId));
    if (q.search) conditions.push(like(schema.blogs.title, `%${q.search}%`));

    const [totalRow] = await db.select({ value: count() }).from(schema.blogs).where(and(...conditions));
    const rows = await db.query.blogs.findMany({
      where: and(...conditions),
      with: {
        blogCategory: { columns: { id: true, name: true, handle: true } },
        author: { columns: { id: true, name: true } },
        writer: { columns: { id: true, name: true, username: true } },
      },
      orderBy: [desc(schema.blogs.createdAt)],
      limit: q.limit,
      offset: (q.page - 1) * q.limit,
    });
    return c.json(paginate(rows, q.page, q.limit, totalRow.value));
  })
  .get("/published", requireTenant(), async (c) => {
    const db = c.get("db");
    const q = paginationSchema
      .extend({ search: z.string().optional(), categoryId: z.coerce.number().int().optional() })
      .parse(c.req.query());
    const conditions = [
      eq(schema.blogs.tenantId, c.get("tenantId")),
      eq(schema.blogs.published, true),
      eq(schema.blogs.inTrash, false),
    ];
    if (q.search) conditions.push(like(schema.blogs.title, `%${q.search}%`));
    if (q.categoryId) conditions.push(eq(schema.blogs.blogCategoryId, q.categoryId));
    const [totalRow] = await db.select({ value: count() }).from(schema.blogs).where(and(...conditions));
    const rows = await db.query.blogs.findMany({
      where: and(...conditions),
      with: { blogCategory: { columns: { id: true, name: true, handle: true } }, writer: { columns: { id: true, name: true, image: true } } },
      orderBy: [desc(schema.blogs.publishedAt)],
      limit: q.limit,
      offset: (q.page - 1) * q.limit,
      columns: {
        id: true,
        title: true,
        slug: true,
        coverImage: true,
        tags: true,
        publishedAt: true,
        metaDescription: true,
        views: true,
        likes: true,
        postType: true,
      },
    });
    return c.json(paginate(rows, q.page, q.limit, totalRow.value));
  })
  .get("/slug/:slug", requireTenant(), async (c) => {
    const db = c.get("db");
    const row = await db.query.blogs.findFirst({
      where: and(
        eq(schema.blogs.tenantId, c.get("tenantId")),
        eq(schema.blogs.slug, c.req.param("slug")),
        // Website visitors only see live posts; staff can preview drafts.
        c.get("staff") ? undefined : and(eq(schema.blogs.published, true), eq(schema.blogs.inTrash, false)),
      ),
      with: { blogCategory: true, author: { columns: { id: true, name: true } }, writer: true },
    });
    if (!row) throw new ApiError(404, "Post not found");
    return c.json({ post: row });
  })
  .get("/:id{[0-9]+}", requireStaff(), requireTenant(), async (c) => {
    const db = c.get("db");
    const row = await db.query.blogs.findFirst({
      where: and(eq(schema.blogs.tenantId, c.get("tenantId")), eq(schema.blogs.id, Number(c.req.param("id")))),
    });
    if (!row) throw new ApiError(404, "Post not found");
    return c.json({ post: row });
  })
  .post("/", requireStaff(), requireTenant(), async (c) => {
    const body = blogBaseSchema.parse(await c.req.json());
    const db = c.get("db");
    const tenantId = c.get("tenantId");
    await assertPlanLimit(db, tenantId, "posts");
    const slug = slugify(body.slug || body.title);
    const existing = await db.query.blogs.findFirst({
      where: and(eq(schema.blogs.tenantId, tenantId), eq(schema.blogs.slug, slug)),
    });
    if (existing) throw new ApiError(409, "Slug already in use", "SLUG_TAKEN");
    const staff = c.get("staff")!;
    const { slug: _s, ...data } = body;
    const [post] = await db
      .insert(schema.blogs)
      .values({
        tenantId,
        ...data,
        slug,
        publishedAt: body.published ? new Date() : null,
        authorId: staff.id,
      })
      .returning();
    return c.json({ post }, 201);
  })
  .patch("/:id", requireStaff(), requireTenant(), async (c) => {
    const id = Number(c.req.param("id"));
    const body = blogBaseSchema.partial().parse(await c.req.json());
    const db = c.get("db");
    const tenantId = c.get("tenantId");
    const existing = await db.query.blogs.findFirst({
      where: and(eq(schema.blogs.id, id), eq(schema.blogs.tenantId, tenantId)),
    });
    if (!existing) throw new ApiError(404, "Post not found");

    const { slug: newSlug, ...updates } = body;
    const payload: Partial<typeof schema.blogs.$inferInsert> = { ...updates, updatedAt: new Date() };
    if (newSlug !== undefined) {
      const slug = slugify(newSlug);
      if (slug !== existing.slug) {
        const clash = await db.query.blogs.findFirst({
          where: and(eq(schema.blogs.tenantId, tenantId), eq(schema.blogs.slug, slug)),
        });
        if (clash) throw new ApiError(409, "Slug already in use", "SLUG_TAKEN");
        const history = Array.isArray(existing.urlHistory) ? [...existing.urlHistory] : [];
        if (!history.includes(existing.slug)) history.push(existing.slug);
        payload.slug = slug;
        payload.urlHistory = history;
      }
    }
    if (payload.published && !existing.published) payload.publishedAt = new Date();

    const [post] = await db
      .update(schema.blogs)
      .set(payload)
      .where(eq(schema.blogs.id, id))
      .returning();
    return c.json({ post });
  })
  .patch("/:id/trash", requireStaff(), requireTenant(), async (c) => {
    const db = c.get("db");
    const [post] = await db
      .update(schema.blogs)
      .set({ inTrash: true, updatedAt: new Date() })
      .where(
        and(eq(schema.blogs.id, Number(c.req.param("id"))), eq(schema.blogs.tenantId, c.get("tenantId"))),
      )
      .returning({ id: schema.blogs.id });
    if (!post) throw new ApiError(404, "Post not found");
    return c.json({ ok: true });
  })
  .patch("/:id/restore", requireStaff(), requireTenant(), async (c) => {
    const db = c.get("db");
    await assertPlanLimit(db, c.get("tenantId"), "posts");
    const [post] = await db
      .update(schema.blogs)
      .set({ inTrash: false, updatedAt: new Date() })
      .where(
        and(eq(schema.blogs.id, Number(c.req.param("id"))), eq(schema.blogs.tenantId, c.get("tenantId"))),
      )
      .returning({ id: schema.blogs.id });
    if (!post) throw new ApiError(404, "Post not found");
    return c.json({ ok: true });
  })
  .delete("/:id", requireStaff("OWNER", "ADMIN"), requireTenant(), async (c) => {
    const db = c.get("db");
    await db
      .delete(schema.blogs)
      .where(
        and(eq(schema.blogs.id, Number(c.req.param("id"))), eq(schema.blogs.tenantId, c.get("tenantId"))),
      );
    return c.json({ ok: true });
  });

// ── Info pages ───────────────────────────────────────────────────────────────

export const infoPageRoutes = new Hono<AppEnv>()
  .get("/", requireStaff(), requireTenant(), async (c) => {
    const db = c.get("db");
    const rows = await db.query.infoPages.findMany({
      where: eq(schema.infoPages.tenantId, c.get("tenantId")),
      with: { category: { columns: { id: true, name: true, handle: true } } },
      orderBy: [desc(schema.infoPages.createdAt)],
    });
    return c.json({ data: rows });
  })
  .get("/slug/:slug", requireTenant(), async (c) => {
    const db = c.get("db");
    const row = await db.query.infoPages.findFirst({
      where: and(
        eq(schema.infoPages.tenantId, c.get("tenantId")),
        eq(schema.infoPages.slug, c.req.param("slug")),
        eq(schema.infoPages.published, true),
      ),
      with: { category: true },
    });
    if (!row) throw new ApiError(404, "Page not found");
    return c.json({ page: row });
  })
  .get("/:id{[0-9]+}", requireStaff(), requireTenant(), async (c) => {
    const db = c.get("db");
    const row = await db.query.infoPages.findFirst({
      where: and(eq(schema.infoPages.tenantId, c.get("tenantId")), eq(schema.infoPages.id, Number(c.req.param("id")))),
    });
    if (!row) throw new ApiError(404, "Page not found");
    return c.json({ page: row });
  })
  .post("/", requireStaff(), requireTenant(), async (c) => {
    const body = z
      .object({
        title: z.string().min(1),
        slug: z.string().optional(),
        content: z.string().optional(),
        coverImage: z.string().nullable().optional(),
        metaTitle: z.string().nullable().optional(),
        metaDescription: z.string().nullable().optional(),
        published: z.boolean().optional(),
        featuredInNavbar: z.boolean().optional(),
        infoPageCategoryId: z.number().int().nullable().optional(),
      })
      .parse(await c.req.json());
    const db = c.get("db");
    const tenantId = c.get("tenantId");
    const slug = slugify(body.slug || body.title);
    const [row] = await db
      .insert(schema.infoPages)
      .values({
        tenantId,
        title: body.title,
        slug,
        content: body.content ?? "",
        coverImage: body.coverImage ?? null,
        metaTitle: body.metaTitle ?? null,
        metaDescription: body.metaDescription ?? null,
        published: body.published ?? false,
        featuredInNavbar: body.featuredInNavbar ?? false,
        infoPageCategoryId: body.infoPageCategoryId ?? null,
      })
      .returning();
    return c.json({ page: row }, 201);
  })
  .patch("/:id", requireStaff(), requireTenant(), async (c) => {
    const body = z
      .object({
        title: z.string().min(1).optional(),
        slug: z.string().optional(),
        content: z.string().optional(),
        coverImage: z.string().nullable().optional(),
        metaTitle: z.string().nullable().optional(),
        metaDescription: z.string().nullable().optional(),
        published: z.boolean().optional(),
        featuredInNavbar: z.boolean().optional(),
        infoPageCategoryId: z.number().int().nullable().optional(),
      })
      .partial()
      .parse(await c.req.json());
    const db = c.get("db");
    const { slug: newSlug, ...updates } = body;
    const payload: Partial<typeof schema.infoPages.$inferInsert> = { ...updates, updatedAt: new Date() };
    if (newSlug !== undefined) payload.slug = slugify(newSlug);
    const [row] = await db
      .update(schema.infoPages)
      .set(payload)
      .where(
        and(
          eq(schema.infoPages.id, Number(c.req.param("id"))),
          eq(schema.infoPages.tenantId, c.get("tenantId")),
        ),
      )
      .returning();
    if (!row) throw new ApiError(404, "Page not found");
    return c.json({ page: row });
  })
  .delete("/:id", requireStaff("OWNER", "ADMIN"), requireTenant(), async (c) => {
    const db = c.get("db");
    await db
      .delete(schema.infoPages)
      .where(
        and(
          eq(schema.infoPages.id, Number(c.req.param("id"))),
          eq(schema.infoPages.tenantId, c.get("tenantId")),
        ),
      );
    return c.json({ ok: true });
  });

// ── Info page / blog categories ──────────────────────────────────────────────

export const infoPageCategoryRoutes = new Hono<AppEnv>()
  .get("/", requireTenant(), async (c) => {
    const db = c.get("db");
    const rows = await db.query.infoPageCategories.findMany({
      where: eq(schema.infoPageCategories.tenantId, c.get("tenantId")),
      orderBy: [schema.infoPageCategories.handle],
    });
    return c.json({ data: rows });
  })
  .post("/", requireStaff(), requireTenant(), async (c) => {
    const body = z.object({ name: z.string().min(1), handle: z.string().optional() }).parse(await c.req.json());
    const db = c.get("db");
    const [row] = await db
      .insert(schema.infoPageCategories)
      .values({
        tenantId: c.get("tenantId"),
        name: body.name,
        handle: slugify(body.handle || body.name),
      })
      .returning();
    return c.json({ category: row }, 201);
  })
  .patch("/:id", requireStaff(), requireTenant(), async (c) => {
    const body = z.object({ name: z.string().min(1).optional(), handle: z.string().optional() }).parse(await c.req.json());
    const db = c.get("db");
    const [row] = await db
      .update(schema.infoPageCategories)
      .set({
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.handle !== undefined ? { handle: slugify(body.handle) } : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.infoPageCategories.id, Number(c.req.param("id"))),
          eq(schema.infoPageCategories.tenantId, c.get("tenantId")),
        ),
      )
      .returning();
    if (!row) throw new ApiError(404, "Category not found");
    return c.json({ category: row });
  })
  .delete("/:id", requireStaff("OWNER", "ADMIN"), requireTenant(), async (c) => {
    const db = c.get("db");
    await db
      .delete(schema.infoPageCategories)
      .where(
        and(
          eq(schema.infoPageCategories.id, Number(c.req.param("id"))),
          eq(schema.infoPageCategories.tenantId, c.get("tenantId")),
        ),
      );
    return c.json({ ok: true });
  });

// ── Media ────────────────────────────────────────────────────────────────────

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "application/pdf",
]);

async function assertStorageQuota(
  db: AppEnv["Variables"] extends { db: infer D } ? D : never,
  tenantId: number,
  planBytes: number,
  incomingBytes: number,
) {
  const [row] = await db.all<{ total: number | null }>(sql`
    SELECT COALESCE(SUM(${schema.media.fileSize}), 0) AS total FROM ${schema.media}
    WHERE ${schema.media.tenantId} = ${tenantId}
  `);
  const used = Number(row?.total ?? 0);
  if (used + incomingBytes > planBytes) {
    throw new ApiError(413, "Storage quota exceeded", "STORAGE_QUOTA");
  }
}

export const mediaRoutes = new Hono<AppEnv>()
  .get("/", requireStaff(), requireTenant(), async (c) => {
    const db = c.get("db");
    const q = paginationSchema.extend({ search: z.string().optional() }).parse(c.req.query());
    const conditions = [eq(schema.media.tenantId, c.get("tenantId"))];
    if (q.search) conditions.push(like(schema.media.filename, `%${q.search}%`));
    const [totalRow] = await db.select({ value: count() }).from(schema.media).where(and(...conditions));
    const rows = await db.query.media.findMany({
      where: and(...conditions),
      orderBy: [desc(schema.media.createdAt)],
      limit: q.limit,
      offset: (q.page - 1) * q.limit,
    });
    const [storageRow] = await db.all<{ total: number | null }>(sql`
      SELECT COALESCE(SUM(${schema.media.fileSize}), 0) AS total FROM ${schema.media}
      WHERE ${schema.media.tenantId} = ${c.get("tenantId")}
    `);
    return c.json({
      ...paginate(rows, q.page, q.limit, totalRow.value),
      storageUsedBytes: Number(storageRow?.total ?? 0),
    });
  })
  .post("/upload", requireStaff(), requireTenant(), async (c) => {
    const db = c.get("db");
    const tenantId = c.get("tenantId");
    const form = await c.req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "file field is required");
    if (!ALLOWED_MIME.has(file.type)) throw new ApiError(415, `Unsupported file type: ${file.type}`);
    if (file.size > 10 * 1024 * 1024) throw new ApiError(413, "File exceeds 10MB limit");

    const { limits } = await tenantLimits(db, tenantId);
    const buffer = await file.arrayBuffer();
    await assertStorageQuota(db, tenantId, limits.storageBytes, buffer.byteLength);

    const key = mediaKey(tenantId, file.name);
    const stored = await putObject(c.env, key, buffer, file.type);
    const [row] = await db
      .insert(schema.media)
      .values({
        tenantId,
        url: stored.url,
        filename: file.name,
        mimeType: file.type,
        fileSize: file.size,
      })
      .returning();
    return c.json({ media: row }, 201);
  })
  .patch("/:id", requireStaff(), requireTenant(), async (c) => {
    const body = z
      .object({
        alt: z.string().nullable().optional(),
        caption: z.string().nullable().optional(),
        title: z.string().nullable().optional(),
        description: z.string().nullable().optional(),
      })
      .parse(await c.req.json());
    const db = c.get("db");
    const [row] = await db
      .update(schema.media)
      .set({ ...body, updatedAt: new Date() })
      .where(
        and(eq(schema.media.id, Number(c.req.param("id"))), eq(schema.media.tenantId, c.get("tenantId"))),
      )
      .returning();
    if (!row) throw new ApiError(404, "Media not found");
    return c.json({ media: row });
  })
  .delete("/:id", requireStaff(), requireTenant(), async (c) => {
    const db = c.get("db");
    const tenantId = c.get("tenantId");
    const row = await db.query.media.findFirst({
      where: and(eq(schema.media.id, Number(c.req.param("id"))), eq(schema.media.tenantId, tenantId)),
    });
    if (!row) throw new ApiError(404, "Media not found");
    const keyMatch = row.url.match(/\/media\/file\/(.+)$/);
    if (keyMatch) await deleteObject(c.env, keyMatch[1]);
    await db.delete(schema.media).where(eq(schema.media.id, row.id));
    return c.json({ ok: true });
  });

export const mediaFileRoutes = new Hono<AppEnv>().get("/:key{.+}", async (c) => {
  const key = c.req.param("key");
  const object = await getObject(c.env, key);
  if (!object) return c.json({ error: "Not found" }, 404);
  const headers = new Headers();
  headers.set("Content-Type", object.httpMetadata?.contentType ?? "application/octet-stream");
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  headers.set("Access-Control-Allow-Origin", "*");
  return new Response(object.body, { headers });
});

// ── Redirects ────────────────────────────────────────────────────────────────

export const redirectRoutes = new Hono<AppEnv>()
  .get("/", requireStaff(), requireTenant(), async (c) => {
    const db = c.get("db");
    const rows = await db.query.redirects.findMany({
      where: eq(schema.redirects.tenantId, c.get("tenantId")),
      orderBy: [desc(schema.redirects.createdAt)],
    });
    return c.json({ data: rows });
  })
  .put("/", requireStaff(), requireTenant(), async (c) => {
    const body = z
      .object({
        from: z.string().min(1),
        to: z.string().min(1),
        permanent: z.boolean().optional(),
      })
      .parse(await c.req.json());
    const db = c.get("db");
    const tenantId = c.get("tenantId");
    const from = body.from.startsWith("/") ? body.from : `/${body.from}`;
    if (from === body.to) throw new ApiError(400, "Redirect source and destination are identical");
    const existing = await db.query.redirects.findFirst({
      where: and(eq(schema.redirects.tenantId, tenantId), eq(schema.redirects.from, from)),
    });
    if (existing) {
      const [row] = await db
        .update(schema.redirects)
        .set({ to: body.to, permanent: body.permanent ?? true, updatedAt: new Date() })
        .where(eq(schema.redirects.id, existing.id))
        .returning();
      return c.json({ redirect: row });
    }
    const [row] = await db
      .insert(schema.redirects)
      .values({ tenantId, from, to: body.to, permanent: body.permanent ?? true })
      .returning();
    return c.json({ redirect: row }, 201);
  })
  .delete("/:id", requireStaff("OWNER", "ADMIN"), requireTenant(), async (c) => {
    const db = c.get("db");
    await db
      .delete(schema.redirects)
      .where(
        and(
          eq(schema.redirects.id, Number(c.req.param("id"))),
          eq(schema.redirects.tenantId, c.get("tenantId")),
        ),
      );
    return c.json({ ok: true });
  });

// ── Team & departments ───────────────────────────────────────────────────────

export const teamRoutes = new Hono<AppEnv>()
  .get("/", requireTenant(), async (c) => {
    const db = c.get("db");
    const tenantId = c.get("tenantId");
    const departments = await db.query.teamDepartments.findMany({
      where: eq(schema.teamDepartments.tenantId, tenantId),
    });
    const members = await db.query.teamMembers.findMany({
      where: eq(schema.teamMembers.tenantId, tenantId),
      with: { department: { columns: { id: true, name: true } } },
    });
    return c.json({ departments, members });
  })
  .post("/", requireStaff(), requireTenant(), async (c) => {
    const body = z
      .object({
        name: z.string().min(1),
        designation: z.string().nullable().optional(),
        about: z.string().nullable().optional(),
        image: z.string().nullable().optional(),
        departmentId: z.number().int().nullable().optional(),
      })
      .parse(await c.req.json());
    const db = c.get("db");
    const [row] = await db
      .insert(schema.teamMembers)
      .values({ tenantId: c.get("tenantId"), ...body, image: body.image ?? null })
      .returning();
    return c.json({ member: row }, 201);
  })
  .patch("/:id", requireStaff(), requireTenant(), async (c) => {
    const body = z
      .object({
        name: z.string().min(1).optional(),
        designation: z.string().nullable().optional(),
        about: z.string().nullable().optional(),
        image: z.string().nullable().optional(),
        departmentId: z.number().int().nullable().optional(),
      })
      .parse(await c.req.json());
    const db = c.get("db");
    const [row] = await db
      .update(schema.teamMembers)
      .set({ ...body, updatedAt: new Date() })
      .where(
        and(
          eq(schema.teamMembers.id, Number(c.req.param("id"))),
          eq(schema.teamMembers.tenantId, c.get("tenantId")),
        ),
      )
      .returning();
    if (!row) throw new ApiError(404, "Team member not found");
    return c.json({ member: row });
  })
  .delete("/:id", requireStaff("OWNER", "ADMIN"), requireTenant(), async (c) => {
    const db = c.get("db");
    await db
      .delete(schema.teamMembers)
      .where(
        and(
          eq(schema.teamMembers.id, Number(c.req.param("id"))),
          eq(schema.teamMembers.tenantId, c.get("tenantId")),
        ),
      );
    return c.json({ ok: true });
  });

export const departmentRoutes = new Hono<AppEnv>()
  .get("/", requireTenant(), async (c) => {
    const db = c.get("db");
    const rows = await db.query.teamDepartments.findMany({
      where: eq(schema.teamDepartments.tenantId, c.get("tenantId")),
    });
    return c.json({ data: rows });
  })
  .post("/", requireStaff(), requireTenant(), async (c) => {
    const body = z
      .object({ name: z.string().min(1), description: z.string().nullable().optional() })
      .parse(await c.req.json());
    const db = c.get("db");
    const [row] = await db
      .insert(schema.teamDepartments)
      .values({ tenantId: c.get("tenantId"), name: body.name, description: body.description ?? null })
      .returning();
    return c.json({ department: row }, 201);
  })
  .patch("/:id", requireStaff(), requireTenant(), async (c) => {
    const body = z
      .object({ name: z.string().min(1).optional(), description: z.string().nullable().optional() })
      .parse(await c.req.json());
    const db = c.get("db");
    const [row] = await db
      .update(schema.teamDepartments)
      .set({ ...body, updatedAt: new Date() })
      .where(
        and(
          eq(schema.teamDepartments.id, Number(c.req.param("id"))),
          eq(schema.teamDepartments.tenantId, c.get("tenantId")),
        ),
      )
      .returning();
    if (!row) throw new ApiError(404, "Department not found");
    return c.json({ department: row });
  })
  .delete("/:id", requireStaff("OWNER", "ADMIN"), requireTenant(), async (c) => {
    const db = c.get("db");
    await db
      .delete(schema.teamDepartments)
      .where(
        and(
          eq(schema.teamDepartments.id, Number(c.req.param("id"))),
          eq(schema.teamDepartments.tenantId, c.get("tenantId")),
        ),
      );
    return c.json({ ok: true });
  });

// ── Documents ────────────────────────────────────────────────────────────────

export const documentRoutes = new Hono<AppEnv>()
  .get("/", requireTenant(), async (c) => {
    const db = c.get("db");
    const rows = await db.query.documents.findMany({
      where: and(eq(schema.documents.tenantId, c.get("tenantId")), eq(schema.documents.published, true)),
    });
    return c.json({ data: rows });
  })
  .get("/all", requireStaff(), requireTenant(), async (c) => {
    const db = c.get("db");
    const rows = await db.query.documents.findMany({
      where: eq(schema.documents.tenantId, c.get("tenantId")),
      orderBy: [desc(schema.documents.createdAt)],
    });
    return c.json({ data: rows });
  })
  .post("/", requireStaff(), requireTenant(), async (c) => {
    const body = z
      .object({ title: z.string().min(1), path: z.string().min(1), published: z.boolean().optional() })
      .parse(await c.req.json());
    const db = c.get("db");
    const [row] = await db
      .insert(schema.documents)
      .values({ tenantId: c.get("tenantId"), ...body, published: body.published ?? false })
      .returning();
    return c.json({ document: row }, 201);
  })
  .patch("/:id", requireStaff(), requireTenant(), async (c) => {
    const body = z
      .object({ title: z.string().min(1).optional(), path: z.string().min(1).optional(), published: z.boolean().optional() })
      .parse(await c.req.json());
    const db = c.get("db");
    const [row] = await db
      .update(schema.documents)
      .set({ ...body, updatedAt: new Date() })
      .where(
        and(eq(schema.documents.id, Number(c.req.param("id"))), eq(schema.documents.tenantId, c.get("tenantId"))),
      )
      .returning();
    if (!row) throw new ApiError(404, "Document not found");
    return c.json({ document: row });
  })
  .delete("/:id", requireStaff("OWNER", "ADMIN"), requireTenant(), async (c) => {
    const db = c.get("db");
    await db
      .delete(schema.documents)
      .where(
        and(eq(schema.documents.id, Number(c.req.param("id"))), eq(schema.documents.tenantId, c.get("tenantId"))),
      );
    return c.json({ ok: true });
  });
