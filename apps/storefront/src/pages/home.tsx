import { raw } from "hono/html";
import type { Section } from "@/lib/api";
import { safeHtml } from "@/lib/format";
import { Flash, Layout, link, type Ctx } from "@/ui/layout";
import { PostFeature, PostRow, TripCard, TripFeature } from "@/ui/cards";

const Head = ({ section, more }: { section: Section; more?: { label: string; href: string } }) => (
  <div class="head">
    <div>
      {section.title ? <h2>{section.title}</h2> : null}
      {section.subtitle ? <p>{section.subtitle}</p> : null}
    </div>
    {more ? (
      <a class="more" href={more.href}>
        {more.label} →
      </a>
    ) : null}
  </div>
);

function Render({ s, ctx, flash }: { s: Section; ctx: Ctx; flash: { subscribed?: string; error?: string } }) {
  const { base } = ctx;
  const data = s.data ?? [];
  switch (s.type) {
    case "HERO":
      return (
        <section class={s.image ? "hero has-image" : "hero"}>
          {s.image ? <img class="hero-bg" src={s.image} alt="" /> : null}
          <div class="wrap hero-inner">
            <h1>{s.title}</h1>
            {s.subtitle ? <p class="sub">{s.subtitle}</p> : null}
            {s.ctaLabel && s.ctaHref ? (
              <div class="actions">
                <a class="btn light" href={link(base, s.ctaHref)}>
                  {s.ctaLabel}
                </a>
              </div>
            ) : null}
          </div>
        </section>
      );
    case "FEATURED_TRIPS":
      return data.length ? (
        <section class="block">
          <div class="wrap">
            <Head section={s} more={{ label: "All trips", href: `${base}/trips` }} />
            <TripFeature trip={data[0] as any} base={base} currency={ctx.currency} />
            {data.length > 1 ? (
              <div class="grid trips" style="margin-top:clamp(40px,6vw,72px)">
                {data.slice(1).map((t) => (
                  <TripCard trip={t as any} base={base} currency={ctx.currency} />
                ))}
              </div>
            ) : null}
          </div>
        </section>
      ) : null;
    case "DESTINATIONS":
      return data.length ? (
        <section class="block tint">
          <div class="wrap">
            <Head section={s} />
            <div class="mosaic">
              {data.map((d) => (
                <a class={d.image ? "tile" : "tile plain"} href={`${base}/destinations/${d.handle}`}>
                  {d.image ? <img src={d.image} alt="" loading="lazy" /> : null}
                  <span class="label">
                    <b>{d.name}</b>
                    <small>Explore</small>
                  </span>
                </a>
              ))}
            </div>
          </div>
        </section>
      ) : null;
    case "CATEGORIES":
      return data.length ? (
        <section class="block">
          <div class="wrap">
            <Head section={s} />
            <div class="topics">
              {data.map((c) => (
                <a class="topic" href={`${base}/trips/category/${c.handle}`}>
                  <span>{c.name}</span>
                  <small>Explore →</small>
                </a>
              ))}
            </div>
          </div>
        </section>
      ) : null;
    case "TESTIMONIALS":
      return data.length ? (
        <section class="block ink">
          <div class="wrap">
            <Head section={s} />
            <div class="quotes">
              {data.map((t) => (
                <figure class="quote">
                  {t.rating ? <div class="stars" aria-label={`${t.rating} out of 5`}>{"★".repeat(t.rating)}</div> : null}
                  <p class="q" style={t.rating ? "margin-top:14px" : ""}>“{t.content}”</p>
                  <figcaption class="by">
                    {t.media ? <img src={t.media} alt="" /> : null}
                    <span>{t.author ?? "A happy traveller"}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      ) : null;
    case "LATEST_POSTS":
      return data.length ? (
        <section class="block">
          <div class="wrap">
            <Head section={s} more={{ label: "All stories", href: `${base}/blog` }} />
            <PostFeature post={data[0]} base={base} />
            {data.length > 1 ? (
              <div class="post-list">
                {data.slice(1).map((p) => (
                  <PostRow post={p} base={base} />
                ))}
              </div>
            ) : null}
          </div>
        </section>
      ) : null;
    case "NEWSLETTER":
      return (
        <section class="block newsletter" id="newsletter">
          <div class="wrap">
            <div class="panel">
              {s.title ? <h2>{s.title}</h2> : null}
              {s.subtitle ? <p>{s.subtitle}</p> : null}
              {flash.subscribed || flash.error ? (
                <div style="margin-top:28px">
                  <Flash subscribed={flash.subscribed} error={flash.error} />
                </div>
              ) : (
                <form class="signup" method="post" action={`${base}/_/subscribe`}>
                  <input type="hidden" name="back" value={`${base || "/"}#newsletter`} />
                  <label class="sr" for="nl">
                    Email address
                  </label>
                  <input id="nl" type="email" name="email" placeholder="Your email address" required autocomplete="email" />
                  <button class="btn light" type="submit">
                    Subscribe
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>
      );
    case "CUSTOM_TEXT":
      return (
        <section class="block">
          <div class="wrap">
            <div class="two" style={s.image ? "" : "grid-template-columns:1fr"}>
              <div>
                {s.title ? <h2 class="split-title">{s.title}</h2> : null}
                {s.subtitle ? <p class="muted" style="font-size:1.15rem;margin-bottom:20px;max-width:48ch">{s.subtitle}</p> : null}
                <div class="prose">{raw(safeHtml(s.body))}</div>
                {s.ctaLabel && s.ctaHref ? (
                  <p style="margin-top:28px">
                    <a class="btn" href={link(base, s.ctaHref)}>
                      {s.ctaLabel}
                    </a>
                  </p>
                ) : null}
              </div>
              {s.image ? <img src={s.image} alt="" loading="lazy" /> : null}
            </div>
          </div>
        </section>
      );
    default:
      return null;
  }
}

export function Home({ ctx, flash }: { ctx: Ctx; flash: { subscribed?: string; error?: string } }) {
  const sections = ctx.site.homepage;
  return (
    <Layout ctx={ctx}>
      {sections.length ? (
        sections.map((s) => <Render s={s} ctx={ctx} flash={flash} />)
      ) : (
        <section class="hero">
          <div class="wrap hero-inner">
            <h1>{ctx.site.company.name}</h1>
          </div>
        </section>
      )}
    </Layout>
  );
}
