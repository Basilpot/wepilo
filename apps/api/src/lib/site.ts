import { z } from "zod";
import { and, asc, desc, eq } from "drizzle-orm";
import type { Db } from "@/db";
import * as schema from "@/db/schema";

const short = z.string().trim().max(200);
const url = z.string().trim().max(500);

const navItem: z.ZodType<NavItem> = z.lazy(() =>
  z.object({
    label: z.string().trim().min(1).max(60),
    href: url.min(1),
    children: z.array(navItem).max(12).optional(),
  }),
);
export type NavItem = { label: string; href: string; children?: NavItem[] };

export const SECTION_TYPES = [
  "HERO",
  "FEATURED_TRIPS",
  "DESTINATIONS",
  "CATEGORIES",
  "TESTIMONIALS",
  "LATEST_POSTS",
  "NEWSLETTER",
  "CUSTOM_TEXT",
] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

const homeSection = z.object({
  id: z.string().trim().min(1).max(40),
  type: z.enum(SECTION_TYPES),
  enabled: z.boolean().default(true),
  title: short.nullish(),
  subtitle: z.string().trim().max(500).nullish(),
  /** How many items a list section shows. */
  limit: z.number().int().min(1).max(24).nullish(),
  /** HERO: background image. CUSTOM_TEXT: optional side image. */
  image: url.nullish(),
  /** CUSTOM_TEXT body (plain text or simple HTML from the rich editor). */
  body: z.string().max(20_000).nullish(),
  ctaLabel: z.string().trim().max(60).nullish(),
  ctaHref: url.nullish(),
});
export type HomeSection = z.infer<typeof homeSection>;

const menu = z.object({
  /** AUTO builds the menu from published content; MANUAL uses `items` exactly as saved. */
  mode: z.enum(["AUTO", "MANUAL"]).default("AUTO"),
  items: z.array(navItem).max(20).default([]),
});

export const siteConfigSchema = z.object({
  homepage: z.object({ sections: z.array(homeSection).max(30) }),
  navigation: z.object({
    header: menu,
    footer: z.object({
      mode: z.enum(["AUTO", "MANUAL"]).default("AUTO"),
      columns: z.array(z.object({ title: z.string().trim().min(1).max(60), items: z.array(navItem).max(15) })).max(6).default([]),
    }),
  }),
  /** URL patterns the website uses, so generated links match its routes. {slug} / {handle} are replaced. */
  paths: z.object({
    trips: short.default("/trips"),
    trip: short.default("/trips/{slug}"),
    category: short.default("/trips/category/{handle}"),
    destination: short.default("/destinations/{handle}"),
    posts: short.default("/blog"),
    post: short.default("/blog/{slug}"),
    page: short.default("/{slug}"),
  }),
  social: z.object({
    facebook: url.nullish(),
    instagram: url.nullish(),
    x: url.nullish(),
    youtube: url.nullish(),
    tiktok: url.nullish(),
    linkedin: url.nullish(),
    whatsapp: z.string().trim().max(40).nullish(),
  }),
  seo: z.object({
    siteTitle: short.nullish(),
    description: z.string().trim().max(500).nullish(),
    ogImage: url.nullish(),
  }),
  announcement: z.object({ enabled: z.boolean().default(false), text: z.string().trim().max(200).default(""), href: url.nullish() }),
});
export type SiteConfig = z.infer<typeof siteConfigSchema>;

export function defaultSiteConfig(): SiteConfig {
  const section = (type: SectionType, title: string, extra: Partial<HomeSection> = {}): HomeSection => ({
    id: type.toLowerCase(),
    type,
    enabled: true,
    title,
    ...extra,
  });
  return {
    homepage: {
      sections: [
        section("HERO", "Journeys worth taking", { subtitle: "Small groups, local guides, honest prices.", ctaLabel: "Browse trips", ctaHref: "/trips" }),
        section("FEATURED_TRIPS", "Featured trips", { limit: 6 }),
        section("DESTINATIONS", "Where we go", { limit: 8 }),
        section("CATEGORIES", "Trip styles", { limit: 8 }),
        section("TESTIMONIALS", "What travellers say", { limit: 6 }),
        section("LATEST_POSTS", "From the journal", { limit: 3 }),
        section("NEWSLETTER", "Get trip ideas in your inbox"),
      ],
    },
    navigation: { header: { mode: "AUTO", items: [] }, footer: { mode: "AUTO", columns: [] } },
    paths: {
      trips: "/trips",
      trip: "/trips/{slug}",
      category: "/trips/category/{handle}",
      destination: "/destinations/{handle}",
      posts: "/blog",
      post: "/blog/{slug}",
      page: "/{slug}",
    },
    social: {},
    seo: {},
    announcement: { enabled: false, text: "" },
  };
}

/** Stored config laid over the defaults; a malformed or older stored value never breaks the site. */
export function readSiteConfig(stored: unknown): SiteConfig {
  const defaults = defaultSiteConfig();
  const parsed = siteConfigSchema.safeParse({ ...defaults, ...(stored && typeof stored === "object" ? (stored as object) : {}) });
  return parsed.success ? parsed.data : defaults;
}

const fill = (pattern: string, values: Record<string, string>) =>
  pattern.replace(/\{(\w+)\}/g, (_, k: string) => encodeURIComponent(values[k] ?? ""));

/** The menus as the website should render them: manual ones as saved, automatic ones from published content. */
export async function resolveNavigation(db: Db, tenantId: number, config: SiteConfig) {
  const { paths, navigation } = config;
  const needAuto = navigation.header.mode === "AUTO" || navigation.footer.mode === "AUTO";
  const [pages, categories, tags] = needAuto
    ? await Promise.all([
        db.query.infoPages.findMany({
          where: and(eq(schema.infoPages.tenantId, tenantId), eq(schema.infoPages.published, true)),
          columns: { title: true, slug: true, featuredInNavbar: true },
          orderBy: [asc(schema.infoPages.title)],
          limit: 40,
        }),
        db.query.tripCategories.findMany({
          where: eq(schema.tripCategories.tenantId, tenantId),
          columns: { name: true, handle: true },
          orderBy: [asc(schema.tripCategories.name)],
          limit: 12,
        }),
        db.query.featuredTags.findMany({
          where: and(eq(schema.featuredTags.tenantId, tenantId), eq(schema.featuredTags.showOnHomepage, true)),
          columns: { name: true, slug: true },
          orderBy: [asc(schema.featuredTags.order)],
          limit: 8,
        }),
      ])
    : [[], [], []];

  const pageItem = (p: { title: string | null; slug: string | null }): NavItem | null =>
    p.slug ? { label: p.title ?? p.slug, href: fill(paths.page, { slug: p.slug }) } : null;
  const compact = (items: Array<NavItem | null>) => items.filter((i): i is NavItem => i !== null);

  const header: NavItem[] =
    navigation.header.mode === "MANUAL"
      ? navigation.header.items
      : [
          {
            label: "Trips",
            href: paths.trips,
            ...(categories.length
              ? { children: categories.map((c) => ({ label: c.name ?? c.handle, href: fill(paths.category, { handle: c.handle }) })) }
              : {}),
          },
          { label: "Blog", href: paths.posts },
          ...compact(pages.filter((p) => p.featuredInNavbar).map(pageItem)),
        ];

  const footer =
    navigation.footer.mode === "MANUAL"
      ? navigation.footer.columns
      : [
          ...(tags.length || categories.length
            ? [
                {
                  title: "Explore",
                  items: [
                    ...tags.map((t) => ({ label: t.name, href: `${paths.trips}?tag=${encodeURIComponent(t.slug)}` })),
                    ...categories.slice(0, 6).map((c) => ({ label: c.name ?? c.handle, href: fill(paths.category, { handle: c.handle }) })),
                  ].slice(0, 10),
                },
              ]
            : []),
          ...(pages.length ? [{ title: "Company", items: compact(pages.map(pageItem)).slice(0, 10) }] : []),
        ];
  return { header, footer };
}

/** Each enabled homepage section with the content it shows, so the website renders it in one request. */
export async function resolveHomepage(db: Db, tenantId: number, config: SiteConfig) {
  const { paths } = config;
  const out: Array<HomeSection & { data?: unknown[] }> = [];
  for (const section of config.homepage.sections) {
    if (!section.enabled) continue;
    const limit = section.limit ?? 6;
    let data: unknown[] | undefined;
    switch (section.type) {
      case "FEATURED_TRIPS": {
        const rows = await db.query.activities.findMany({
          where: and(eq(schema.activities.tenantId, tenantId), eq(schema.activities.status, "PUBLISHED"), eq(schema.activities.isFeatured, true)),
          columns: { id: true, title: true, slug: true, price: true, duration: true, images: true, averageRating: true, difficultyLevel: true },
          with: { tripSeo: { columns: { featuredMedia: true } } },
          orderBy: [desc(schema.activities.popularityScore), desc(schema.activities.createdAt)],
          limit,
        });
        data = rows.map(({ tripSeo, ...r }) => ({ ...r, url: fill(paths.trip, { slug: r.slug }), image: tripSeo?.featuredMedia ?? (Array.isArray(r.images) ? (r.images[0] ?? null) : null) }));
        break;
      }
      case "DESTINATIONS": {
        const rows = await db.query.locations.findMany({
          where: and(eq(schema.locations.tenantId, tenantId), eq(schema.locations.showOnHomepage, true)),
          columns: { id: true, type: true, handle: true, name: true, image: true },
          orderBy: [asc(schema.locations.name)],
          limit,
        });
        data = rows.map((r) => ({ ...r, url: fill(paths.destination, { handle: r.handle }) }));
        break;
      }
      case "CATEGORIES": {
        const rows = await db.query.tripCategories.findMany({
          where: and(eq(schema.tripCategories.tenantId, tenantId), eq(schema.tripCategories.showOnHomepage, true)),
          columns: { id: true, handle: true, name: true, image: true },
          orderBy: [asc(schema.tripCategories.name)],
          limit,
        });
        data = rows.map((r) => ({ ...r, url: fill(paths.category, { handle: r.handle }) }));
        break;
      }
      case "TESTIMONIALS":
        data = await db.query.testimonials.findMany({
          where: eq(schema.testimonials.tenantId, tenantId),
          columns: { id: true, rating: true, content: true, author: true, media: true },
          orderBy: [desc(schema.testimonials.createdAt)],
          limit,
        });
        break;
      case "LATEST_POSTS": {
        const rows = await db.query.blogs.findMany({
          where: and(eq(schema.blogs.tenantId, tenantId), eq(schema.blogs.published, true), eq(schema.blogs.inTrash, false)),
          columns: { id: true, title: true, slug: true, coverImage: true, publishedAt: true, metaDescription: true },
          orderBy: [desc(schema.blogs.publishedAt), desc(schema.blogs.createdAt)],
          limit,
        });
        data = rows.map((r) => ({ ...r, url: fill(paths.post, { slug: r.slug }) }));
        break;
      }
      default:
        break;
    }
    out.push(data ? { ...section, data } : section);
  }
  return out;
}
