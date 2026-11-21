/**
 * Structured data (schema.org JSON-LD) for the pages search engines care about most: the agency,
 * each trip (TouristTrip with its itinerary, dates and prices), trip FAQs and journal posts.
 */
import { abs, type Ctx } from "@/ui/layout";
import { images, list, plain } from "@/lib/format";

const clean = <T extends Record<string, unknown>>(o: T) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && !v.length)));

/** The agency itself, as a TravelAgency. */
export function agency(ctx: Ctx) {
  const c = ctx.site.company;
  const social = Object.values(ctx.site.social).filter((v): v is string => typeof v === "string" && v.startsWith("http"));
  return clean({
    "@context": "https://schema.org",
    "@type": "TravelAgency",
    "@id": `${abs(ctx, "").replace(/\/?$/, "/")}#agency`,
    name: c.name ?? undefined,
    url: abs(ctx, ""),
    logo: c.logo ?? undefined,
    image: ctx.site.seo.ogImage ?? c.logo ?? undefined,
    description: c.description ?? undefined,
    email: c.email ?? undefined,
    telephone: c.phone ?? undefined,
    address: c.address ?? undefined,
    sameAs: social,
  });
}

export function website(ctx: Ctx) {
  return clean({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: ctx.site.seo.siteTitle ?? ctx.site.company.name ?? undefined,
    url: abs(ctx, ""),
    inLanguage: ctx.lang ?? ctx.site.languages?.default ?? "en",
  });
}

const breadcrumbs = (ctx: Ctx, trail: Array<[string, string]>) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: trail.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: abs(ctx, path) })),
});

/** A trip page: the agency's own schema if they wrote one, otherwise a TouristTrip built from the trip. */
export function trip(ctx: Ctx, t: Record<string, any>, departures: Record<string, any>[], reviewCount: number): unknown[] {
  const url = abs(ctx, `/trips/${t.slug}`);
  const out: unknown[] = [breadcrumbs(ctx, [["Trips", "/trips"], [t.title, `/trips/${t.slug}`]])];

  // A hand-written schema in the trip's SEO step wins. Ignore it if it isn't valid JSON.
  const custom = t.tripSeo?.schema;
  if (typeof custom === "string" && custom.trim()) {
    try {
      return [...out, JSON.parse(custom)];
    } catch {
      /* fall through to the generated one */
    }
  }

  const items = list<any>(t.itinerary);
  const days: Array<{ title?: string; description?: string }> = items[0] && Array.isArray(items[0].days) ? items[0].days : items;
  const price = t.price != null ? Number(t.price) : null;
  const offer = (o: Record<string, unknown>) => clean({ "@type": "Offer", priceCurrency: ctx.currency, url, ...o });
  const offers = departures.length
    ? departures.map((d) =>
        offer({
          price: d.price != null ? Number(d.price) : (price ?? undefined),
          availability: d.status === "FULL" || d.availableSpots === 0 ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
          availabilityStarts: d.startDate,
          availabilityEnds: d.endDate ?? undefined,
        }),
      )
    : price != null
      ? [offer({ price, availability: "https://schema.org/InStock" })]
      : [];
  const rating = Number(t.averageRating ?? 0);

  out.push(
    clean({
      "@context": "https://schema.org",
      "@type": "TouristTrip",
      name: t.title,
      description: t.tripSeo?.metaDescription || plain(t.overview, 300) || undefined,
      url,
      image: [t.tripSeo?.featuredMedia, ...images(t.images).slice(0, 5)].filter(Boolean),
      inLanguage: ctx.lang ?? ctx.site.languages?.default ?? "en",
      touristType: t.difficultyLevel ? String(t.difficultyLevel).toLowerCase() : undefined,
      itinerary: days.length
        ? {
            "@type": "ItemList",
            numberOfItems: days.length,
            itemListElement: days.map((d, i) => clean({ "@type": "ListItem", position: i + 1, name: d.title || `Day ${i + 1}`, description: plain(d.description, 300) || undefined })),
          }
        : undefined,
      offers,
      provider: { "@id": `${abs(ctx, "").replace(/\/?$/, "/")}#agency`, "@type": "TravelAgency", name: ctx.site.company.name ?? undefined, url: abs(ctx, "") },
      aggregateRating: rating > 0 && reviewCount > 0 ? { "@type": "AggregateRating", ratingValue: rating.toFixed(1), reviewCount, bestRating: 5 } : undefined,
    }),
  );

  const faqs = list<{ items?: { q: string; a: string }[] }>(t.faq).flatMap((g) => list<{ q: string; a: string }>(g.items));
  if (faqs.length) {
    out.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.filter((f) => f.q && f.a).map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: plain(f.a, 1000) } })),
    });
  }
  return out;
}

export function post(ctx: Ctx, p: Record<string, any>): unknown[] {
  return [
    breadcrumbs(ctx, [["Journal", "/blog"], [p.title, `/blog/${p.slug}`]]),
    clean({
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: p.title,
      description: p.metaDescription || plain(p.content, 300) || undefined,
      image: p.coverImage ?? undefined,
      url: abs(ctx, `/blog/${p.slug}`),
      datePublished: p.publishedAt ?? p.createdAt ?? undefined,
      dateModified: p.updatedAt ?? undefined,
      inLanguage: ctx.lang ?? ctx.site.languages?.default ?? "en",
      author: p.writer?.name ? { "@type": "Person", name: p.writer.name } : { "@id": `${abs(ctx, "").replace(/\/?$/, "/")}#agency` },
      publisher: { "@id": `${abs(ctx, "").replace(/\/?$/, "/")}#agency`, "@type": "TravelAgency", name: ctx.site.company.name ?? undefined },
    }),
  ];
}
