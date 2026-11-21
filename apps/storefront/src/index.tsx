import { Hono } from "hono";
import type { Context } from "hono";
import { ApiProblem, client, type Env } from "@/lib/api";
import { Home } from "@/pages/home";
import { TripList, TripPage } from "@/pages/trips";
import { BlogList, Contact, InfoPage, PostPage, Problem } from "@/pages/content";
import type { Ctx } from "@/ui/layout";

type C = Context<{ Bindings: Env }>;

/**
 * Languages
 * ---------
 * Every page is served in the agency's original language at its plain address and in each other
 * language under its code: /trips/kilimanjaro and /de/trips/kilimanjaro. The same routes are
 * mounted twice below; `load` works out the language and asks the API for it (`?lang=de`).
 */
const LANG = "[a-z]{2,3}(?:-[A-Za-z0-9]{2,4})?";

class NotALanguage extends Error {}

/** Everything a page needs about the agency, fetched once per request. */
async function load(c: C) {
  const slug = c.req.param("slug") ?? "";
  const lang = c.req.param("lang");
  const siteBase = c.env.TENANT_SLUG ? "" : `/${slug}`;
  const api = client(c.env, slug, lang);
  const [site, cur] = await Promise.all([api.site(), api.currency()]);
  const languages = site.languages ?? { default: "en", available: ["en"] };
  if (lang && (!languages.available.includes(lang) || lang === languages.default)) throw new NotALanguage(lang);
  const base = `${siteBase}${lang ? `/${lang}` : ""}`;
  const path = c.req.path.slice(`/${slug}${lang ? `/${lang}` : ""}`.length);
  const ctx: Ctx = { site, base, siteBase, lang, path: path === "/" ? "" : path, currency: cur.base, origin: new URL(c.req.url).origin };
  return { api, ctx };
}

const flashOf = (c: C) => ({ sent: c.req.query("sent"), subscribed: c.req.query("subscribed"), error: c.req.query("error") });

/** Where a form sends the visitor back to. Only paths on this site are allowed. */
const backTo = (c: C, back: unknown, fallback: string, params: Record<string, string>) => {
  const raw = typeof back === "string" && back.startsWith("/") && !back.startsWith("//") ? back : fallback;
  const [path, hash = ""] = raw.split("#");
  const url = new URL(path, "http://x");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return `${url.pathname}${url.search}${hash ? `#${hash}` : ""}`;
};

/** The prefix a form posted from should send the visitor back under. */
const formBase = (c: C) => {
  const slug = c.req.param("slug") ?? "";
  const lang = c.req.param("lang");
  return `${c.env.TENANT_SLUG ? "" : `/${slug}`}${lang ? `/${lang}` : ""}`;
};

/** The agency's pages. Mounted at /:slug and at /:slug/:lang. */
const site = new Hono<{ Bindings: Env }>();

site.get("/", async (c) => {
  try {
    const { ctx } = await load(c);
    return c.html(<Home ctx={ctx} flash={flashOf(c)} />);
  } catch (err) {
    // "/agency/faq": a short page slug that looks like a language code, not a language.
    if (err instanceof NotALanguage) {
      const slug = c.req.param("slug") ?? "";
      const siteBase = c.env.TENANT_SLUG ? "" : `/${slug}`;
      const api = client(c.env, slug);
      const [s, cur, { page }] = await Promise.all([api.site(), api.currency(), api.page(err.message)]);
      return c.html(<InfoPage ctx={{ site: s, base: siteBase, siteBase, path: `/${err.message}`, currency: cur.base, origin: new URL(c.req.url).origin }} page={page} />);
    }
    throw err;
  }
});

site.get("/trips", async (c) => {
  const { api, ctx } = await load(c);
  const [trips, cats] = await Promise.all([api.trips(), api.categories()]);
  return c.html(<TripList ctx={ctx} trips={trips.data} categories={cats.data} heading="All trips" intro="Every journey we run, in one place." />);
});

site.get("/trips/category/:handle", async (c) => {
  const { api, ctx } = await load(c);
  const cats = (await api.categories()).data;
  const category = cats.find((x) => x.handle === c.req.param("handle"));
  if (!category) return c.notFound();
  const trips = await api.trips({ categoryId: category.id });
  return c.html(<TripList ctx={ctx} trips={trips.data} categories={cats} heading={category.name} activeCategory={category.handle} />);
});

site.get("/destinations/:handle", async (c) => {
  const { api, ctx } = await load(c);
  const place = (await api.locations()).data.find((x) => x.handle === c.req.param("handle"));
  if (!place) return c.notFound();
  const [trips, cats] = await Promise.all([api.trips({ locationId: place.id }), api.categories()]);
  return c.html(<TripList ctx={ctx} trips={trips.data} categories={cats.data} heading={place.name} intro={`Trips that visit ${place.name}.`} />);
});

site.get("/trips/:tripSlug", async (c) => {
  const { api, ctx } = await load(c);
  const res = (await api.trip(c.req.param("tripSlug"))) as { activity: any; redirectTo?: string };
  // A renamed trip answers with its new address. Send visitors there so old links keep working.
  if (res.redirectTo) return c.redirect(`${ctx.base}/trips/${res.activity.slug}`, 301);
  const [departures, reviews] = await Promise.all([api.departures(res.activity.id), api.reviews(res.activity.id)]);
  return c.html(
    <TripPage ctx={ctx} trip={res.activity} departures={departures.data} reviews={reviews.data} reviewCount={reviews.pagination?.total ?? reviews.data.length} flash={flashOf(c)} />,
  );
});

site.get("/blog", async (c) => {
  const { api, ctx } = await load(c);
  const posts = await api.posts().catch(() => ({ data: [] }));
  return c.html(<BlogList ctx={ctx} posts={posts.data} />);
});

site.get("/blog/:postSlug", async (c) => {
  const { api, ctx } = await load(c);
  const { post } = await api.post(c.req.param("postSlug"));
  return c.html(<PostPage ctx={ctx} post={post} />);
});

site.get("/contact", async (c) => {
  const { ctx } = await load(c);
  return c.html(<Contact ctx={ctx} flash={flashOf(c)} />);
});

// Forms: the visitor's browser posts here, we pass it to the API, then send them back with a message.
// An enquiry is emailed straight to the agency; nothing is stored.
site.post("/_/inquiry", async (c) => {
  const base = formBase(c);
  const f = await c.req.parseBody();
  const travellers = Number(f.travellers);
  try {
    await client(c.env, c.req.param("slug") ?? "").inquiry({
      name: String(f.name ?? ""),
      email: String(f.email ?? ""),
      phone: f.phone ? String(f.phone) : undefined,
      trip: f.trip ? String(f.trip) : undefined,
      departureDate: f.departureDate ? String(f.departureDate) : undefined,
      travellers: Number.isInteger(travellers) && travellers > 0 ? travellers : undefined,
      message: String(f.message ?? ""),
    });
    return c.redirect(backTo(c, f.back, `${base}/contact`, { sent: "1" }), 303);
  } catch (err) {
    return c.redirect(backTo(c, f.back, `${base}/contact`, { error: err instanceof ApiProblem ? err.message : "Something went wrong. Please try again." }), 303);
  }
});

site.post("/_/subscribe", async (c) => {
  const base = formBase(c);
  const f = await c.req.parseBody();
  try {
    await client(c.env, c.req.param("slug") ?? "").subscribe(String(f.email ?? ""));
    return c.redirect(backTo(c, f.back, base || "/", { subscribed: "1" }), 303);
  } catch (err) {
    return c.redirect(backTo(c, f.back, base || "/", { error: err instanceof ApiProblem ? err.message : "Something went wrong. Please try again." }), 303);
  }
});

// Search engines: every public page, in every language, with each page's other-language versions.
site.get("/sitemap.xml", async (c) => {
  if (c.req.param("lang")) return c.notFound();
  const slug = c.req.param("slug") ?? "";
  const api = client(c.env, slug);
  const [site, trips, posts, pages, cats, places] = await Promise.all([
    api.site(),
    api.every("/activities"),
    api.every("/blogs/published"),
    api.pages(),
    api.categories().catch(() => ({ data: [] })),
    api.locations().catch(() => ({ data: [] })),
  ]);
  const origin = `${new URL(c.req.url).origin}${c.env.TENANT_SLUG ? "" : `/${slug}`}`;
  const langs = site.languages ?? { default: "en", available: ["en"] };
  const at = (code: string, path: string) => `${origin}${`${code === langs.default ? "" : `/${code}`}${path}` || (c.env.TENANT_SLUG ? "/" : "")}`;
  const day = (v: unknown) => {
    const d = v ? new Date(v as string) : null;
    return d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : null;
  };
  const entries: Array<[string, string | null]> = [
    ["", null],
    ["/trips", null],
    ["/blog", day(posts[0]?.publishedAt)],
    ["/contact", null],
    ...trips.map((t): [string, string | null] => [`/trips/${t.slug}`, day(t.updatedAt)]),
    ...cats.data.map((x): [string, string | null] => [`/trips/category/${x.handle}`, null]),
    ...places.data.map((x): [string, string | null] => [`/destinations/${x.handle}`, null]),
    ...posts.map((p): [string, string | null] => [`/blog/${p.slug}`, day(p.updatedAt ?? p.publishedAt)]),
    ...pages.data.map((p): [string, string | null] => [`/${p.slug}`, day(p.updatedAt)]),
  ];
  const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  const multi = langs.available.length > 1;
  const urls = entries.flatMap(([path, lastmod]) =>
    langs.available.map(
      (code) =>
        `<url><loc>${esc(at(code, path))}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}${
          multi ? langs.available.map((alt) => `<xhtml:link rel="alternate" hreflang="${alt}" href="${esc(at(alt, path))}"/>`).join("") : ""
        }</url>`,
    ),
  );
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join("\n")}\n</urlset>\n`;
  return c.body(xml, 200, { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" });
});

site.get("/robots.txt", (c) => {
  if (c.req.param("lang")) return c.notFound();
  // Only a site on its own domain is indexed; a path-prefixed preview stays out of search.
  if (!c.env.TENANT_SLUG) return c.text("User-agent: *\nDisallow: /\n");
  return c.text(`User-agent: *\nAllow: /\nDisallow: /_/\n\nSitemap: ${new URL(c.req.url).origin}/sitemap.xml\n`);
});

// Pages the agency wrote (About, Terms, Privacy…). Last, so it never shadows the routes above.
site.get("/:pageSlug", async (c) => {
  const { api, ctx } = await load(c);
  const { page } = await api.page(c.req.param("pageSlug"));
  return c.html(<InfoPage ctx={ctx} page={page} />);
});

const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) =>
  c.html(
    <Problem
      title="Wepilo storefront"
      text="Open /your-workspace-slug to see an agency's site. The dashboard's Preview site button takes you there."
    />,
  ),
);

// The language-prefixed copy first, so /agency/de/trips isn't read as a page called "de".
app.route(`/:slug/:lang{${LANG}}`, site);
app.route("/:slug", site);

const baseOf = (c: C) => (c.env.TENANT_SLUG ? "" : c.req.path.split("/")[1] ? `/${c.req.path.split("/")[1]}` : undefined);

app.notFound((c) => c.html(<Problem title="We couldn't find that page" text="The link may be old, or the page may have been taken down." base={baseOf(c)} />, 404));

app.onError((err, c) => {
  const base = baseOf(c);
  // /agency/xx/… where xx isn't one of the agency's languages.
  if (err instanceof NotALanguage) return c.html(<Problem title="We couldn't find that page" text="The link may be old, or the page may have been taken down." base={base} />, 404);
  if (err instanceof ApiProblem) {
    // The API answers 400 when it cannot tell which agency the address belongs to.
    if (err.status === 400) return c.html(<Problem title="There's no site here" text="We couldn't find a workspace at this address. Check the link and try again." />, 404);
    if (err.status === 404) return c.html(<Problem title="We couldn't find that" text="The link may be old, or the page may have been taken down." base={base} />, 404);
    if (err.status === 402) return c.html(<Problem title="This site isn't live yet" text="Its Wepilo plan needs to be active before the content is public. If you own this site, check your plan in the dashboard." />, 402);
  }
  console.error(err);
  return c.html(<Problem title="Something went wrong" text="We couldn't load this page. Please try again in a moment." base={base} />, 500);
});

export default {
  fetch(req: Request, env: Env, ctx: ExecutionContext) {
    // One agency on the whole site (its own domain): serve it from the root by pretending the slug is in the path.
    if (env.TENANT_SLUG) {
      const url = new URL(req.url);
      url.pathname = `/${env.TENANT_SLUG}${url.pathname === "/" ? "" : url.pathname}`;
      return app.fetch(new Request(url, req), env, ctx);
    }
    return app.fetch(req, env, ctx);
  },
};
