import type { Child } from "hono/jsx";
import { raw } from "hono/html";
import type { NavItem, Site } from "@/lib/api";
import { css } from "@/ui/styles";

export type Ctx = {
  site: Site;
  /**
   * Path prefix for links: the agency ("/himal-trails" when serving any agency, "" on its own
   * domain), plus the language ("/de") when the visitor is reading another language.
   */
  base: string;
  /** The agency's prefix without a language, for switching languages. */
  siteBase: string;
  /** The language being shown; undefined is the original. */
  lang?: string;
  /** The rest of the path after the prefix, e.g. "/trips/kilimanjaro", for the same page in other languages. */
  path: string;
  /** The agency's currency, for prices. */
  currency: string;
  /** "https://your-agency.travel", for canonical links and structured data. */
  origin: string;
};

/** The absolute address of a path on this site, e.g. abs(ctx, "/trips/x"). */
export const abs = (ctx: Ctx, path = ctx.path) => `${ctx.origin}${`${ctx.base}${path}` || "/"}`;

/** Structured data for search engines. `<` is escaped so text in it can't close the script tag. */
export const JsonLd = ({ data }: { data: unknown }) => (
  <script type="application/ld+json">{raw(JSON.stringify(data).replace(/</g, "\\u003c"))}</script>
);

/** The same page in another language: the original at the root, the others under their code. */
export const inLanguage = (ctx: Ctx, code: string) => {
  const def = ctx.site.languages?.default ?? "en";
  return `${ctx.siteBase}${code === def ? "" : `/${code}`}${ctx.path}` || "/";
};

/** "de" → "Deutsch": each language named in itself, as visitors expect in a switcher. */
const nativeName = (code: string) => {
  try {
    const n = new Intl.DisplayNames([code], { type: "language" }).of(code);
    return n ? n.charAt(0).toUpperCase() + n.slice(1) : code;
  } catch {
    return code;
  }
};

function LanguageLinks({ ctx }: { ctx: Ctx }) {
  const langs = ctx.site.languages;
  if (!langs || langs.available.length < 2) return null;
  const current = ctx.lang ?? langs.default;
  return (
    <ul class="langs" aria-label="Language">
      {langs.available.map((code) => (
        <li>
          <a href={inLanguage(ctx, code)} hreflang={code} lang={code} aria-current={code === current ? "true" : undefined}>
            {nativeName(code)}
          </a>
        </li>
      ))}
    </ul>
  );
}

/** Links inside the agency's content start with "/", so they need the prefix. Everything else is left alone. */
export const link = (base: string, href: string) => (href.startsWith("/") ? `${base}${href === "/" ? "" : href}` || "/" : href);

const SOCIAL: [string, string][] = [
  ["instagram", "Instagram"],
  ["facebook", "Facebook"],
  ["youtube", "YouTube"],
  ["x", "X"],
  ["tiktok", "TikTok"],
  ["linkedin", "LinkedIn"],
];

function NavList({ items, base }: { items: NavItem[]; base: string }) {
  return (
    <ul>
      {items.map((item) => (
        <li>
          <a class="top" href={link(base, item.href)}>
            {item.label}
          </a>
          {item.children?.length ? (
            <ul class="sub">
              {item.children.map((child) => (
                <li>
                  <a href={link(base, child.href)}>{child.label}</a>
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function Layout({
  ctx,
  title,
  description,
  image,
  noindex,
  canonical,
  schema,
  children,
}: {
  ctx: Ctx;
  title?: string;
  description?: string | null;
  image?: string | null;
  noindex?: boolean;
  /** The preferred address of this page; defaults to the page itself. */
  canonical?: string | null;
  /** JSON-LD objects describing the page. */
  schema?: unknown[];
  children?: Child;
}) {
  const { site, base } = ctx;
  const name = site.company.name ?? "Our trips";
  const fullTitle = title ? `${title} · ${name}` : (site.seo.siteTitle ?? name);
  const desc = description ?? site.seo.description ?? site.company.description ?? "";
  const og = image ?? site.seo.ogImage ?? site.company.logo;
  const nav = site.navigation.header;
  const flat = nav.flatMap((i) => [i, ...(i.children ?? [])]);

  return (
    <html lang={ctx.lang ?? site.languages?.default ?? "en"}>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{fullTitle}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Anton&family=Archivo:wght@400;500;600;700&display=swap" rel="stylesheet" />
        {desc ? <meta name="description" content={desc} /> : null}
        <meta property="og:title" content={fullTitle} />
        {desc ? <meta property="og:description" content={desc} /> : null}
        {og ? <meta property="og:image" content={og} /> : null}
        <link rel="canonical" href={canonical || abs(ctx)} />
        <meta property="og:url" content={canonical || abs(ctx)} />
        {(schema ?? []).map((data) => (
          <JsonLd data={data} />
        ))}
        {/* The same page in every language the agency publishes in, so search engines show each visitor theirs. */}
        {(site.languages?.available.length ?? 0) > 1
          ? [
              ...site.languages!.available.map((code) => <link rel="alternate" hreflang={code} href={`${ctx.origin}${inLanguage(ctx, code)}`} />),
              <link rel="alternate" hreflang="x-default" href={`${ctx.origin}${inLanguage(ctx, site.languages!.default)}`} />,
            ]
          : null}
        {/* A path-prefixed preview should never be indexed. A site on its own domain should be. */}
        {noindex ?? base !== "" ? <meta name="robots" content="noindex" /> : null}
        <style>{raw(css)}</style>
      </head>
      <body>
        <a class="skip" href="#main">Skip to content</a>
        {site.announcement ? (
          <div class="announce">
            {site.announcement.href ? <a href={link(base, site.announcement.href)}>{site.announcement.text}</a> : site.announcement.text}
          </div>
        ) : null}

        <header class="site">
          <div class="wrap bar">
            <a class="brand" href={base || "/"}>
              {site.company.logo ? <img src={site.company.logo} alt="" /> : null}
              {site.company.logo ? <span class="sr">{name}</span> : name}
            </a>
            <nav class="main" aria-label="Main">
              <NavList items={nav} base={base} />
              <a class="btn sm" href={`${base}/contact`}>
                Plan a trip
              </a>
            </nav>
            <details class="menu">
              <summary>Menu</summary>
              <div class="sheet">
                {flat.map((i) => (
                  <a href={link(base, i.href)}>{i.label}</a>
                ))}
                <a href={`${base}/contact`}>Plan a trip</a>
                <LanguageLinks ctx={ctx} />
              </div>
            </details>
          </div>
        </header>

        <main id="main">{children}</main>

        <footer class="site">
          <div class="wrap">
            <div class="fgrid">
              <div>
                <div class="fbrand">{name}</div>
                {site.company.description ? <p class="muted" style="margin-top:14px;max-width:38ch">{site.company.description}</p> : null}
                <ul style="margin-top:22px">
                  {site.company.email ? (
                    <li>
                      <a href={`mailto:${site.company.email}`}>{site.company.email}</a>
                    </li>
                  ) : null}
                  {site.company.phone ? <li>{site.company.phone}</li> : null}
                  {site.company.address ? <li class="muted">{site.company.address}</li> : null}
                </ul>
              </div>
              {site.navigation.footer.map((col) => (
                <div>
                  <h4>{col.title}</h4>
                  <ul>
                    {col.items.map((i) => (
                      <li>
                        <a href={link(base, i.href)}>{i.label}</a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {SOCIAL.some(([k]) => site.social[k]) ? (
                <div>
                  <h4>Follow</h4>
                  <ul>
                    {SOCIAL.filter(([k]) => site.social[k]).map(([k, label]) => (
                      <li>
                        <a href={site.social[k]!} rel="noopener noreferrer" target="_blank">
                          {label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
            <div class="fbottom">
              <span>
                © {new Date().getFullYear()} {name}
              </span>
              <LanguageLinks ctx={ctx} />
              <span>Built with Wepilo</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}

export const Flash = ({ sent, subscribed, error }: { sent?: string; subscribed?: string; error?: string }) =>
  error ? (
    <div class="flash err" role="alert">
      {error}
    </div>
  ) : sent ? (
    <div class="flash ok" role="status">
      Thank you. Your message is on its way to the team, and they will reply soon.
    </div>
  ) : subscribed ? (
    <div class="flash ok" role="status">
      You're on the list. Thank you for subscribing.
    </div>
  ) : null;
