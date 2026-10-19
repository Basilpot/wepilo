import { Hono } from "hono";
import { z } from "zod";
import { eq, and, desc, asc, like, or, sql, count, inArray } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AppEnv } from "@/types";
import { ApiError, slugify, paginate, paginationSchema, getOffset } from "@/lib/http";
import { requireStaff, requireTenant, assertPlanLimit } from "@/middleware/context";

const jsonList = z.array(z.union([z.string(), z.number(), z.object({}).passthrough()])).optional();

const activityBaseSchema = z.object({
  title: z.string().min(1),
  slug: z.string().optional(),
  layout: z.enum(["ITINERARY", "PAGE"]).optional(),
  overview: z.string().nullable().optional(),
  content: z.string().nullable().optional(),
  highlights: z.string().nullable().optional(),
  inclusions: z.string().nullable().optional(),
  exclusions: z.string().nullable().optional(),
  itinerary: z.array(z.object({}).passthrough()).optional(),
  additionalInfo: z.array(z.object({}).passthrough()).optional(),
  faq: z.array(z.object({}).passthrough()).optional(),
  whatToBring: jsonList,
  keywords: jsonList,
  price: z.number().nonnegative().nullable().optional(),
  maxPrice: z.number().nonnegative().nullable().optional(),
  groupDiscount: z
    .array(
      z.object({
        groupSize: z.number().int().positive(),
        discount: z.number().nonnegative(),
        discountType: z.enum(["PERCENTAGE", "FLAT"]),
      }),
    )
    .optional()
    .nullable(),
  showGroupDiscount: z.boolean().optional(),
  duration: z.string().nullable().optional(),
  groupSize: z.number().int().positive().nullable().optional(),
  guestCapacity: z.number().int().positive().nullable().optional(),
  maximumAltitude: z.number().int().nonnegative().nullable().optional(),
  altitudeChart: z
    .array(
      z.object({
        id: z.string(),
        location: z.string(),
        altitude: z.number(),
      }),
    )
    .optional()
    .nullable(),
  transportation: z.string().nullable().optional(),
  meals: z.string().nullable().optional(),
  bestSeason: z.string().nullable().optional(),
  meetingPoint: z.string().nullable().optional(),
  dropOffPoint: z.string().nullable().optional(),
  videoUrl: z.string().nullable().optional(),
  routeMap: z.string().nullable().optional(),
  mapDescription: z.string().nullable().optional(),
  images: jsonList,
  accommodations: jsonList,
  languages: jsonList,
  difficultyLevel: z.enum(["EASY", "MODERATE", "HARD", "EXTREME"]).nullable().optional(),
  isFeatured: z.boolean().optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
  countryId: z.number().int().nullable().optional(),
  regionId: z.number().int().nullable().optional(),
  cityId: z.number().int().nullable().optional(),
  tripCategoryId: z.number().int().nullable().optional(),
  tripSeo: z
    .object({
      metaTitle: z.string().nullable().optional(),
      metaDescription: z.string().nullable().optional(),
      metaKeywords: z.string().nullable().optional(),
      metaRobots: z.string().nullable().optional(),
      metaAuthor: z.string().nullable().optional(),
      canonicalUrl: z.string().nullable().optional(),
      featuredMedia: z.string().nullable().optional(),
      schema: z.string().nullable().optional(),
    })
    .optional(),
  translations: z.record(z.string(), z.any()).optional(),
  extraIds: z.array(z.number().int()).optional(),
  featuredTagIds: z.array(z.number().int()).optional(),
});

export const catalogRoutes = new Hono<AppEnv>()
  // ── Activities ────────────────────────────────────────────────────────────
  .get("/activities", requireTenant(), async (c) => {
    const db = c.get("db");
    const tenantId = c.get("tenantId");
    const q = paginationSchema.extend({
      search: z.string().optional(),
      status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
      layout: z.enum(["ITINERARY", "PAGE"]).optional(),
      categoryId: z.coerce.number().int().optional(),
      cityId: z.coerce.number().int().optional(),
      regionId: z.coerce.number().int().optional(),
      countryId: z.coerce.number().int().optional(),
      featuredTagId: z.coerce.number().int().optional(),
      sort: z.enum(["newest", "price_asc", "price_desc", "popular"]).default("newest"),
    }).parse(c.req.query());

    const conditions = [eq(schema.activities.tenantId, tenantId)];
    // Website visitors (API key / tenant slug) only ever see published trips.
    if (!c.get("staff")) conditions.push(eq(schema.activities.status, "PUBLISHED"));
    else if (q.status) conditions.push(eq(schema.activities.status, q.status));
    if (q.layout) conditions.push(eq(schema.activities.layout, q.layout));
    if (q.categoryId) conditions.push(eq(schema.activities.tripCategoryId, q.categoryId));
    if (q.cityId) conditions.push(eq(schema.activities.cityId, q.cityId));
    if (q.regionId) conditions.push(eq(schema.activities.regionId, q.regionId));
    if (q.countryId) conditions.push(eq(schema.activities.countryId, q.countryId));
    if (q.search) {
      conditions.push(
        or(
          like(schema.activities.title, `%${q.search}%`),
          like(schema.activities.slug, `%${q.search}%`),
          like(schema.activities.overview, `%${q.search}%`),
        )!,
      );
    }

    let idRows: Array<{ id: number }>;
    if (q.featuredTagId) {
      const tagged = await db
        .select({ activityId: schema.activityToFeaturedTag.activityId })
        .from(schema.activityToFeaturedTag)
        .innerJoin(schema.featuredTags, eq(schema.activityToFeaturedTag.featuredTagId, schema.featuredTags.id))
        .where(eq(schema.activityToFeaturedTag.featuredTagId, q.featuredTagId));
      const taggedIds = new Set(tagged.map((r) => r.activityId));
      const all = await db
        .select({ id: schema.activities.id })
        .from(schema.activities)
        .where(and(...conditions));
      idRows = all.filter((r) => taggedIds.has(r.id));
    } else {
      idRows = await db
        .select({ id: schema.activities.id })
        .from(schema.activities)
        .where(and(...conditions));
    }

    const ids = idRows.map((r) => r.id);
    if (ids.length === 0) {
      return c.json(paginate([], q.page, q.limit, 0));
    }

    const total = ids.length;
    const pageIds = ids.slice(getOffset(q.page, q.limit), getOffset(q.page, q.limit) + q.limit);

    const orderBy =
      q.sort === "price_asc"
        ? asc(schema.activities.price)
        : q.sort === "price_desc"
          ? desc(schema.activities.price)
          : q.sort === "popular"
            ? desc(schema.activities.popularityScore)
            : desc(schema.activities.createdAt);

    const rows = await db.query.activities.findMany({
      where: and(inArray(schema.activities.id, pageIds), eq(schema.activities.tenantId, tenantId)),
      with: {
        tripCategory: { columns: { id: true, handle: true, name: true } },
        city: { columns: { id: true, handle: true, name: true } },
        region: { columns: { id: true, handle: true, name: true } },
        country: { columns: { id: true, handle: true, name: true } },
        tripSeo: true,
      },
      orderBy,
    });

    return c.json(paginate(rows, q.page, q.limit, total));
  })
  .get("/activities/popular", requireTenant(), async (c) => {
    const db = c.get("db");
    const rows = await db.query.activities.findMany({
      where: and(
        eq(schema.activities.tenantId, c.get("tenantId")),
        eq(schema.activities.status, "PUBLISHED"),
      ),
      orderBy: [desc(schema.activities.popularityScore)],
      limit: 8,
      columns: { id: true, title: true, slug: true, layout: true, price: true, images: true, duration: true, difficultyLevel: true, averageRating: true, popularityScore: true },
    });
    return c.json({ data: rows });
  })
  .get("/activities/slug/:slug", requireTenant(), async (c) => {
    const db = c.get("db");
    const slug = c.req.param("slug");
    const tenantId = c.get("tenantId");
    const publicOnly = c.get("staff") ? undefined : eq(schema.activities.status, "PUBLISHED");
    let row = await db.query.activities.findFirst({
      where: and(eq(schema.activities.tenantId, tenantId), eq(schema.activities.slug, slug), publicOnly),
      with: {
        tripCategory: true,
        city: true,
        region: true,
        country: true,
        tripSeo: true,
        featuredTags: { with: { featuredTag: true } },
        extras: { with: { extra: true } },
      },
    });
    if (!row) {
      row = await db.query.activities.findFirst({
        where: and(
          eq(schema.activities.tenantId, tenantId),
          sql`EXISTS (SELECT 1 FROM json_each(${schema.activities.urlHistory}) WHERE json_each.value = ${slug})`,
          publicOnly,
        ),
        with: {
          tripCategory: true,
          city: true,
          region: true,
          country: true,
          tripSeo: true,
          featuredTags: { with: { featuredTag: true } },
          extras: { with: { extra: true } },
        },
      });
      if (row) {
        return c.json(
          { activity: row, redirectTo: `/activity/${row.slug}` },
          200,
          { Location: `/activity/${row.slug}` } as never,
        );
      }
    }
    if (!row) throw new ApiError(404, "Activity not found");
    return c.json({ activity: row });
  })
  .get("/activities/:id", requireTenant(), async (c) => {
    const db = c.get("db");
    const row = await db.query.activities.findFirst({
      where: and(
        eq(schema.activities.id, Number(c.req.param("id"))),
        eq(schema.activities.tenantId, c.get("tenantId")),
        c.get("staff") ? undefined : eq(schema.activities.status, "PUBLISHED"),
      ),
      with: {
        tripCategory: true,
        city: true,
        region: true,
        country: true,
        tripSeo: true,
        featuredTags: { with: { featuredTag: true } },
        extras: { with: { extra: true } },
      },
    });
    if (!row) throw new ApiError(404, "Activity not found");
    return c.json({ activity: row });
  })
  .post("/activities", requireStaff("OWNER", "ADMIN", "MANAGER"), requireTenant(), async (c) => {
    const body = activityBaseSchema.parse(await c.req.json());
    const db = c.get("db");
    const tenantId = c.get("tenantId");
    await assertPlanLimit(db, tenantId, "trips");

    const slug = slugify(body.slug || body.title);
    const existing = await db.query.activities.findFirst({
      where: and(eq(schema.activities.tenantId, tenantId), eq(schema.activities.slug, slug)),
    });
    if (existing) throw new ApiError(409, "Slug already in use", "SLUG_TAKEN");

    let tripSeoId: number | null = null;
    if (body.tripSeo) {
      const [seo] = await db
        .insert(schema.tripSeo)
        .values({ tenantId, ...body.tripSeo })
        .returning();
      tripSeoId = seo.id;
    }

    const { tripSeo: _seo, extraIds, featuredTagIds, ...activityData } = body;
    const [activity] = await db
      .insert(schema.activities)
      .values({
        tenantId,
        ...activityData,
        slug,
        tripSeoId,
        status: body.status ?? "DRAFT",
      })
      .returning();

    if (extraIds?.length) {
      await db
        .insert(schema.activityExtras)
        .values(extraIds.map((extraId) => ({ activityId: activity.id, extraId })));
    }
    if (featuredTagIds?.length) {
      await db
        .insert(schema.activityToFeaturedTag)
        .values(featuredTagIds.map((featuredTagId) => ({ activityId: activity.id, featuredTagId })));
    }

    return c.json({ activity }, 201);
  })
  .patch("/activities/:id", requireStaff("OWNER", "ADMIN", "MANAGER"), requireTenant(), async (c) => {
    const id = Number(c.req.param("id"));
    const body = activityBaseSchema.partial().parse(await c.req.json());
    const db = c.get("db");
    const tenantId = c.get("tenantId");

    const existing = await db.query.activities.findFirst({
      where: and(eq(schema.activities.id, id), eq(schema.activities.tenantId, tenantId)),
    });
    if (!existing) throw new ApiError(404, "Activity not found");

    let tripSeoId = existing.tripSeoId;
    if (body.tripSeo) {
      if (tripSeoId) {
        await db.update(schema.tripSeo).set(body.tripSeo).where(eq(schema.tripSeo.id, tripSeoId));
      } else {
        const [seo] = await db
          .insert(schema.tripSeo)
          .values({ tenantId, ...body.tripSeo })
          .returning();
        tripSeoId = seo.id;
      }
    }

    const { tripSeo: _seo, extraIds, featuredTagIds, slug: newSlug, ...updates } = body;
    const updatePayload: Partial<typeof schema.activities.$inferInsert> = { ...updates, updatedAt: new Date() };

    if (newSlug !== undefined) {
      const slug = slugify(newSlug);
      if (slug !== existing.slug) {
        const clash = await db.query.activities.findFirst({
          where: and(eq(schema.activities.tenantId, tenantId), eq(schema.activities.slug, slug)),
        });
        if (clash) throw new ApiError(409, "Slug already in use", "SLUG_TAKEN");
        const history = Array.isArray(existing.urlHistory) ? [...existing.urlHistory] : [];
        if (!history.includes(existing.slug)) history.push(existing.slug);
        updatePayload.slug = slug;
        updatePayload.urlHistory = history;
      }
    }
    if (tripSeoId !== existing.tripSeoId) updatePayload.tripSeoId = tripSeoId;

    const [activity] = await db
      .update(schema.activities)
      .set(updatePayload)
      .where(eq(schema.activities.id, id))
      .returning();

    if (extraIds) {
      await db.delete(schema.activityExtras).where(eq(schema.activityExtras.activityId, id));
      if (extraIds.length) {
        await db
          .insert(schema.activityExtras)
          .values(extraIds.map((extraId) => ({ activityId: id, extraId })));
      }
    }
    if (featuredTagIds) {
      await db
        .delete(schema.activityToFeaturedTag)
        .where(eq(schema.activityToFeaturedTag.activityId, id));
      if (featuredTagIds.length) {
        await db
          .insert(schema.activityToFeaturedTag)
          .values(featuredTagIds.map((featuredTagId) => ({ activityId: id, featuredTagId })));
      }
    }

    return c.json({ activity });
  })
  .delete("/activities/:id", requireStaff("OWNER", "ADMIN"), requireTenant(), async (c) => {
    const db = c.get("db");
    const id = Number(c.req.param("id"));
    const deleted = await db
      .delete(schema.activities)
      .where(and(eq(schema.activities.id, id), eq(schema.activities.tenantId, c.get("tenantId"))))
      .returning({ id: schema.activities.id });
    if (!deleted.length) throw new ApiError(404, "Activity not found");
    return c.json({ ok: true });
  })
  .post("/activities/:id/view", requireTenant(), async (c) => {
    const db = c.get("db");
    await db
      .update(schema.activities)
      .set({ views: sql`${schema.activities.views} + 1` })
      .where(
        and(
          eq(schema.activities.id, Number(c.req.param("id"))),
          eq(schema.activities.tenantId, c.get("tenantId")),
        ),
      );
    return c.json({ ok: true });
  });

// ── Generic taxonomy factory ────────────────────────────────────────────────

type TaxonomyTable = typeof schema.locations | typeof schema.tripCategories;

const taxonomyBody = z.object({
  handle: z.string().min(1),
  name: z.string().min(1),
  image: z.string().nullable().optional(),
  showOnHomepage: z.boolean().optional(),
  translations: z.record(z.string(), z.any()).optional(),
});

function taxonomyRoutes(table: TaxonomyTable, name: string, locationType?: string) {
  return new Hono<AppEnv>()
    .get("/", requireTenant(), async (c) => {
      const db = c.get("db");
      const scoped = table as unknown as { tenantId: never; type: never };
      const conditions = [eq(scoped.tenantId, c.get("tenantId"))];
      if (locationType) conditions.push(eq(scoped.type, locationType as never));
      const rows = await db
        .select()
        .from(table as TaxonomyTable)
        .where(and(...conditions))
        .orderBy(asc((table as any).handle));
      return c.json({ data: rows });
    })
    .post("/", requireStaff("OWNER", "ADMIN", "MANAGER"), requireTenant(), async (c) => {
      const body = taxonomyBody.parse(await c.req.json());
      const db = c.get("db");
      const tenantId = c.get("tenantId");
      const [row] = await db
        .insert(table as TaxonomyTable)
        .values({
          tenantId,
          ...(locationType ? { type: locationType } : {}),
          handle: slugify(body.handle),
          name: body.name,
          image: body.image ?? null,
          showOnHomepage: body.showOnHomepage ?? false,
          translations: body.translations ?? null,
        } as never)
        .returning();
      return c.json({ [name]: row }, 201);
    })
    .patch("/:id", requireStaff("OWNER", "ADMIN", "MANAGER"), requireTenant(), async (c) => {
      const body = taxonomyBody.partial().parse(await c.req.json());
      const db = c.get("db");
      const [row] = await db
        .update(table as TaxonomyTable)
        .set({
          ...(body.handle !== undefined ? { handle: slugify(body.handle) } : {}),
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.image !== undefined ? { image: body.image } : {}),
          ...(body.showOnHomepage !== undefined ? { showOnHomepage: body.showOnHomepage } : {}),
          ...(body.translations !== undefined ? { translations: body.translations } : {}),
          updatedAt: new Date(),
        } as never)
        .where(
          and(
            eq((table as TaxonomyTable).id, Number(c.req.param("id"))),
            eq((table as TaxonomyTable).tenantId, c.get("tenantId")),
          ),
        )
        .returning();
      if (!row) throw new ApiError(404, `${name} not found`);
      return c.json({ [name]: row });
    })
    .delete("/:id", requireStaff("OWNER", "ADMIN"), requireTenant(), async (c) => {
      const db = c.get("db");
      const deleted = await db
        .delete(table as TaxonomyTable)
        .where(
          and(
            eq((table as TaxonomyTable).id, Number(c.req.param("id"))),
            eq((table as TaxonomyTable).tenantId, c.get("tenantId")),
          ),
        )
        .returning({ id: (table as TaxonomyTable).id });
      if (!deleted.length) throw new ApiError(404, `${name} not found`);
      return c.json({ ok: true });
    });
}

export const countryRoutes = taxonomyRoutes(schema.locations, "country", "COUNTRY");
export const regionRoutes = taxonomyRoutes(schema.locations, "region", "REGION");
export const cityRoutes = taxonomyRoutes(schema.locations, "city", "CITY");
export const tripCategoryRoutes = taxonomyRoutes(schema.tripCategories, "tripCategory");

// ── Featured tags ────────────────────────────────────────────────────────────

export const featuredTagRoutes = new Hono<AppEnv>()
  .get("/", requireTenant(), async (c) => {
    const db = c.get("db");
    const rows = await db.query.featuredTags.findMany({
      where: eq(schema.featuredTags.tenantId, c.get("tenantId")),
      orderBy: [asc(schema.featuredTags.order)],
    });
    return c.json({ data: rows });
  })
  .post("/", requireStaff("OWNER", "ADMIN", "MANAGER"), requireTenant(), async (c) => {
    const body = z
      .object({
        name: z.string().min(1),
        slug: z.string().optional(),
        description: z.string().nullable().optional(),
        showOnHomepage: z.boolean().optional(),
        order: z.number().int().optional(),
      })
      .parse(await c.req.json());
    const db = c.get("db");
    const [row] = await db
      .insert(schema.featuredTags)
      .values({
        tenantId: c.get("tenantId"),
        name: body.name,
        slug: slugify(body.slug || body.name),
        description: body.description ?? null,
        showOnHomepage: body.showOnHomepage ?? false,
        order: body.order ?? 0,
      })
      .returning();
    return c.json({ featuredTag: row }, 201);
  })
  .patch("/reorder", requireStaff("OWNER", "ADMIN", "MANAGER"), requireTenant(), async (c) => {
    const body = z.object({ ids: z.array(z.number().int()).min(1) }).parse(await c.req.json());
    const db = c.get("db");
    for (const [index, id] of body.ids.entries()) {
      await db
        .update(schema.featuredTags)
        .set({ order: index, updatedAt: new Date() })
        .where(and(eq(schema.featuredTags.id, id), eq(schema.featuredTags.tenantId, c.get("tenantId"))));
    }
    return c.json({ ok: true });
  })
  .patch("/:id", requireStaff("OWNER", "ADMIN", "MANAGER"), requireTenant(), async (c) => {
    const body = z
      .object({
        name: z.string().min(1).optional(),
        slug: z.string().optional(),
        description: z.string().nullable().optional(),
        showOnHomepage: z.boolean().optional(),
        order: z.number().int().optional(),
      })
      .parse(await c.req.json());
    const db = c.get("db");
    const [row] = await db
      .update(schema.featuredTags)
      .set({
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.slug !== undefined ? { slug: slugify(body.slug) } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.showOnHomepage !== undefined ? { showOnHomepage: body.showOnHomepage } : {}),
        ...(body.order !== undefined ? { order: body.order } : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.featuredTags.id, Number(c.req.param("id"))),
          eq(schema.featuredTags.tenantId, c.get("tenantId")),
        ),
      )
      .returning();
    if (!row) throw new ApiError(404, "Featured tag not found");
    return c.json({ featuredTag: row });
  })
  .delete("/:id", requireStaff("OWNER", "ADMIN"), requireTenant(), async (c) => {
    const db = c.get("db");
    await db
      .delete(schema.featuredTags)
      .where(
        and(
          eq(schema.featuredTags.id, Number(c.req.param("id"))),
          eq(schema.featuredTags.tenantId, c.get("tenantId")),
        ),
      );
    return c.json({ ok: true });
  });

// ── Extras ──────────────────────────────────────────────────────────────────

export const extraRoutes = new Hono<AppEnv>()
  .get("/", requireTenant(), async (c) => {
    const db = c.get("db");
    const rows = await db.query.extras.findMany({
      where: eq(schema.extras.tenantId, c.get("tenantId")),
      orderBy: [asc(schema.extras.name)],
    });
    return c.json({ data: rows });
  })
  .post("/", requireStaff("OWNER", "ADMIN", "MANAGER"), requireTenant(), async (c) => {
    const body = z
      .object({
        type: z.enum(["ADDON", "ACCOMMODATION", "MEAL", "OTHER"]).default("ADDON"),
        name: z.string().min(1),
        description: z.string().nullable().optional(),
        price: z.number().nonnegative().nullable().optional(),
        images: z.array(z.string()).optional(),
      })
      .parse(await c.req.json());
    const db = c.get("db");
    const [row] = await db
      .insert(schema.extras)
      .values({
        tenantId: c.get("tenantId"),
        type: body.type,
        name: body.name,
        description: body.description ?? null,
        price: body.price ?? null,
        images: body.images ?? [],
      })
      .returning();
    return c.json({ extra: row }, 201);
  })
  .patch("/:id", requireStaff("OWNER", "ADMIN", "MANAGER"), requireTenant(), async (c) => {
    const body = z
      .object({
        type: z.enum(["ADDON", "ACCOMMODATION", "MEAL", "OTHER"]).optional(),
        name: z.string().min(1).optional(),
        description: z.string().nullable().optional(),
        price: z.number().nonnegative().nullable().optional(),
        images: z.array(z.string()).optional(),
      })
      .parse(await c.req.json());
    const db = c.get("db");
    const [row] = await db
      .update(schema.extras)
      .set({ ...body, updatedAt: new Date() })
      .where(
        and(eq(schema.extras.id, Number(c.req.param("id"))), eq(schema.extras.tenantId, c.get("tenantId"))),
      )
      .returning();
    if (!row) throw new ApiError(404, "Extra not found");
    return c.json({ extra: row });
  })
  .delete("/:id", requireStaff("OWNER", "ADMIN"), requireTenant(), async (c) => {
    const db = c.get("db");
    await db
      .delete(schema.extras)
      .where(
        and(eq(schema.extras.id, Number(c.req.param("id"))), eq(schema.extras.tenantId, c.get("tenantId"))),
      );
    return c.json({ ok: true });
  });
