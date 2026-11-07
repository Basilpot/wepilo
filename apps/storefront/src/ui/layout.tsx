import type { Child } from "hono/jsx";
import { raw } from "hono/html";
import type { NavItem, Site } from "@/lib/api";
import { css } from "@/ui/styles";

export type Ctx = {
  site: Site;
  /** Path prefix: "/himal-trails" when serving any agency, "" when one agency owns the whole site. */
  base: string;
  /** The agency's currency, for prices. */
  currency: string;
};

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
  children,
}: {
  ctx: Ctx;
  title?: string;
  description?: string | null;
  image?: string | null;
  noindex?: boolean;
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
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{fullTitle}</title>
        {desc ? <meta name="description" content={desc} /> : null}
        <meta property="og:title" content={fullTitle} />
        {desc ? <meta property="og:description" content={desc} /> : null}
        {og ? <meta property="og:image" content={og} /> : null}
        {/* A path-prefixed preview should never be indexed. A site on its own domain should be. */}
        {noindex ?? base !== "" ? <meta name="robots" content="noindex" /> : null}
        <style>{raw(css)}</style>
      </head>
      <body>
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
              </div>
            </details>
          </div>
        </header>

        <main>{children}</main>

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
