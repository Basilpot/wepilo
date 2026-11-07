import { Hono } from "hono";
import type { Context } from "hono";
import { ApiProblem, client, type Env } from "@/lib/api";
import { Home } from "@/pages/home";
import { TripList, TripPage } from "@/pages/trips";
import { BlogList, Contact, InfoPage, PostPage, Problem } from "@/pages/content";
import type { Ctx } from "@/ui/layout";

type C = Context<{ Bindings: Env }>;

const app = new Hono<{ Bindings: Env }>();

/** Everything a page needs about the agency, fetched once per request. */
async function load(c: C) {
  const slug = c.req.param("slug") ?? "";
  const api = client(c.env, slug);
  const [site, cur] = await Promise.all([api.site(), api.currency()]);
  const ctx: Ctx = { site, base: c.env.TENANT_SLUG ? "" : `/${slug}`, currency: cur.base };
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

app.get("/", (c) =>
  c.html(
    <Problem
      title="Wepilo storefront"
      text="Open /your-workspace-slug to see an agency's site. The dashboard's Preview site button takes you there."
    />,
  ),
);

app.get("/:slug", async (c) => {
  const { ctx } = await load(c);
  return c.html(<Home ctx={ctx} flash={flashOf(c)} />);
});

app.get("/:slug/trips", async (c) => {
  const { api, ctx } = await load(c);
  const [trips, cats] = await Promise.all([api.trips(), api.categories()]);
  return c.html(<TripList ctx={ctx} trips={trips.data} categories={cats.data} heading="All trips" intro="Every journey we run, in one place." />);
});

app.get("/:slug/trips/category/:handle", async (c) => {
  const { api, ctx } = await load(c);
  const cats = (await api.categories()).data;
  const category = cats.find((x) => x.handle === c.req.param("handle"));
  if (!category) return c.notFound();
  const trips = await api.trips({ categoryId: category.id });
  return c.html(<TripList ctx={ctx} trips={trips.data} categories={cats} heading={category.name} activeCategory={category.handle} />);
});

app.get("/:slug/destinations/:handle", async (c) => {
  const { api, ctx } = await load(c);
  const place = (await api.locations()).data.find((x) => x.handle === c.req.param("handle"));
  if (!place) return c.notFound();
  const [trips, cats] = await Promise.all([api.trips({ locationId: place.id }), api.categories()]);
  return c.html(<TripList ctx={ctx} trips={trips.data} categories={cats.data} heading={place.name} intro={`Trips that visit ${place.name}.`} />);
});

app.get("/:slug/trips/:tripSlug", async (c) => {
  const { api, ctx } = await load(c);
  const res = (await api.trip(c.req.param("tripSlug"))) as { activity: any; redirectTo?: string };
  // A renamed trip answers with its new address. Send visitors there so old links keep working.
  if (res.redirectTo) return c.redirect(`${ctx.base}/trips/${res.activity.slug}`, 301);
  const [departures, reviews] = await Promise.all([api.departures(res.activity.id), api.reviews(res.activity.id)]);
  return c.html(<TripPage ctx={ctx} trip={res.activity} departures={departures.data} reviews={reviews.data} flash={flashOf(c)} />);
});

app.get("/:slug/blog", async (c) => {
  const { api, ctx } = await load(c);
  const posts = await api.posts().catch(() => ({ data: [] }));
  return c.html(<BlogList ctx={ctx} posts={posts.data} />);
});

app.get("/:slug/blog/:postSlug", async (c) => {
  const { api, ctx } = await load(c);
  const { post } = await api.post(c.req.param("postSlug"));
  return c.html(<PostPage ctx={ctx} post={post} />);
});

app.get("/:slug/contact", async (c) => {
  const { ctx } = await load(c);
  return c.html(<Contact ctx={ctx} flash={flashOf(c)} />);
});

// Forms: the visitor's browser posts here, we pass it to the API, then send them back with a message.
app.post("/:slug/_/inquiry", async (c) => {
  const slug = c.req.param("slug");
  const base = c.env.TENANT_SLUG ? "" : `/${slug}`;
  const f = await c.req.parseBody();
  try {
    await client(c.env, slug).inquiry({
      name: String(f.name ?? ""),
      email: String(f.email ?? ""),
      phone: f.phone ? String(f.phone) : undefined,
      trip: f.trip ? String(f.trip) : undefined,
      message: String(f.message ?? ""),
    });
    return c.redirect(backTo(c, f.back, `${base}/contact`, { sent: "1" }), 303);
  } catch (err) {
    return c.redirect(backTo(c, f.back, `${base}/contact`, { error: err instanceof ApiProblem ? err.message : "Something went wrong. Please try again." }), 303);
  }
});

app.post("/:slug/_/subscribe", async (c) => {
  const slug = c.req.param("slug");
  const base = c.env.TENANT_SLUG ? "" : `/${slug}`;
  const f = await c.req.parseBody();
  try {
    await client(c.env, slug).subscribe(String(f.email ?? ""));
    return c.redirect(backTo(c, f.back, base || "/", { subscribed: "1" }), 303);
  } catch (err) {
    return c.redirect(backTo(c, f.back, base || "/", { error: err instanceof ApiProblem ? err.message : "Something went wrong. Please try again." }), 303);
  }
});

// Pages the agency wrote (About, Terms, Privacy…). Last, so it never shadows the routes above.
app.get("/:slug/:pageSlug", async (c) => {
  const { api, ctx } = await load(c);
  const { page } = await api.page(c.req.param("pageSlug"));
  return c.html(<InfoPage ctx={ctx} page={page} />);
});

app.notFound((c) => c.html(<Problem title="We couldn't find that page" text="The link may be old, or the page may have been taken down." base={c.env.TENANT_SLUG ? "" : c.req.path.split("/")[1] ? `/${c.req.path.split("/")[1]}` : undefined} />, 404));

app.onError((err, c) => {
  const base = c.env.TENANT_SLUG ? "" : c.req.path.split("/")[1] ? `/${c.req.path.split("/")[1]}` : undefined;
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
