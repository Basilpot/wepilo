# Wepilo API: website integration guide

This guide is for developers building an agency's public website on top of Wepilo. The website reads trips, departures, pages, posts and the rest from the API, and sends enquiries and newsletter sign-ups back to it. Wepilo doesn't take bookings or payments.

- **Base URL (production):** `https://wepiloapi.basilpot.com/api/v1`
- **Base URL (local):** `http://localhost:8787/api/v1`
- **Format:** JSON in and out. Send `Content-Type: application/json` on `POST` requests.

---

## 1. Identify the agency

Every request has to say which agency (tenant) it is for. Use one of these:

| Header | When to use |
| --- | --- |
| `x-api-key: <key>` | **Recommended** for server-side code (Next.js server components, Astro, Nuxt server routes, build scripts). Owners generate the key under Settings → API keys (any paid plan; not during the trial). |
| `x-tenant-slug: <slug>` | Browser-side calls where a secret can't be kept, such as a contact form posting straight from the visitor's browser. The slug is shown under the agency name in the dashboard sidebar. |

Keep the API key on the server. It's shown **once** when generated. If it leaks, revoke it in the dashboard and create a new one.

```bash
curl https://wepiloapi.basilpot.com/api/v1/activities \
  -H "x-api-key: $WEPILO_API_KEY"
```

Without either header, tenant-scoped endpoints return `400 {"error":"Tenant context required"}`.

Website requests only work while the agency has a **paid plan**. They keep working for 15 days after a subscription lapses, but not during the $1 trial. Handle `402 API_ACCESS_INACTIVE` by showing a maintenance page instead of crashing.

Public requests only ever see **published** trips and posts. Drafts are visible only to signed-in staff in the dashboard.

## 2. Conventions

### Pagination

List endpoints take `?page=1&limit=20` (`limit` max 100) and return:

```json
{
  "data": [ ... ],
  "pagination": { "page": 1, "limit": 20, "total": 57, "totalPages": 3 }
}
```

### Errors

Errors use a regular HTTP status with a JSON body:

```json
{ "error": "name: Required", "code": "VALIDATION" }
```

| Status | Meaning |
| --- | --- |
| 400 | Invalid input (`code: "VALIDATION"`) or missing tenant header |
| 401 / 403 | Not signed in / not allowed |
| 404 | Not found, or not published |
| 409 | Conflict, such as `DEPARTURE_CLOSED` or `NOT_ENOUGH_SPOTS` |
| 429 | `RATE_LIMITED`: too many requests from one visitor. Wait the number of seconds in the `Retry-After` header. Public forms (enquiries, newsletter) allow about 12 submissions per visitor per 10 minutes. |
| 402 | `API_ACCESS_INACTIVE`: the agency has no paid plan (new, on trial, or lapsed more than 15 days ago). `PLAN_LIMIT` / `PAYMENT_REQUIRED` only affect dashboard actions. |

### Dates and money

- Timestamps are ISO 8601 strings (`2026-10-19T12:26:16.000Z`).
- Departure `startDate` and `endDate` are plain dates (`2026-11-01`).
- Prices are plain numbers in the agency's currency.

### Images and media

Media fields hold absolute URLs such as `https://wepiloapi.basilpot.com/media/file/<key>`. They're public, cached long-term, and safe to use straight in `<img src>`.

### Rich text

Fields like `overview`, `content`, `highlights`, `inclusions`, `exclusions` and post/page bodies are **HTML** written in the dashboard's editor. Render them as HTML, and sanitise them if your framework expects that (for example DOMPurify or `sanitize-html`).

---

## 3. Trips

### List trips

`GET /activities`

| Query | Description |
| --- | --- |
| `page`, `limit` | Pagination |
| `search` | Matches title, slug and overview |
| `categoryId`, `countryId`, `regionId`, `cityId`, `featuredTagId` | Filters |
| `layout` | `ITINERARY` (multi-day) or `PAGE` (simple page) |
| `sort` | `newest` (default), `price_asc`, `price_desc`, `popular` |

Each item includes the trip fields plus `tripCategory`, `country`, `region`, `city` and `tripSeo`. The fields you'll use most:

| Field | Notes |
| --- | --- |
| `id`, `slug`, `title`, `layout` | `layout` decides which template to render |
| `price`, `maxPrice`, `groupDiscount`, `showGroupDiscount` | "From" price, optional upper price, group discounts |
| `duration`, `difficultyLevel`, `groupSize`, `maximumAltitude`, `bestSeason` | Facts for the trip header |
| `overview`, `highlights`, `inclusions`, `exclusions`, `content` | HTML |
| `itinerary` | Array of day objects (multi-day trips) |
| `altitudeChart` | `[{ id, location, altitude }]` for an altitude graph |
| `images` | Array of image URLs |
| `faq`, `additionalInfo`, `whatToBring` | Lists for the trip page |
| `meetingPoint`, `dropOffPoint`, `meals`, `transportation`, `accommodations`, `languages` | Logistics |
| `averageRating`, `views`, `bookingsCount` | Social proof |
| `tripSeo` | `metaTitle`, `metaDescription`, `canonicalUrl`, `featuredMedia`, `schema` (JSON-LD) |

### Other trip endpoints

| Endpoint | Description |
| --- | --- |
| `GET /activities/popular` | Up to 8 published trips by popularity, with a light set of fields for cards |
| `GET /activities/slug/:slug` | One trip by slug, including `extras` and `featuredTags` |
| `GET /activities/:id` | One trip by id |
| `POST /activities/:id/view` | Count a page view. Call it once per visit to feed "popular" sorting. |

**Renamed trips.** When a trip's slug changes, the old slug still resolves. The response then includes `redirectTo` (and a `Location` header) with the new path, so you can issue a 301:

```json
{ "activity": { ... }, "redirectTo": "/activity/everest-base-camp-trek" }
```

### Taxonomy and extras

| Endpoint | Returns |
| --- | --- |
| `GET /locations` | `{ data: [...] }`, sorted by `handle`. Every place in one list, each with a `type` of `COUNTRY`, `REGION` or `CITY`. Narrow it with `?type=CITY`. |
| `GET /countries`, `GET /regions`, `GET /cities` | The same list filtered to one type: `{ data: [...] }`, sorted by `handle` |
| `GET /trip-categories` | `{ data: [...] }` |
| `GET /featured-tags` | Curated groupings, for example "Best for families" |
| `GET /extras` | Optional add-ons with `price` per person |
| `GET /public/currency` | `{ base, translation, rates, updatedAt }`. `base` is the currency every price is stored in. When the agency has switched on currency translation, `rates` holds one unit of `base` in each currency (about 160), refreshed daily. To show a price in the visitor's currency, multiply it by `rates[their currency]`. When translation is off, `rates` is `null`. Rates come from exchangerate-api.com (free tier), so please link to it. They are a guide for browsing: travellers are always charged in `base`. |
| `GET /public/homepage/sections` | Everything flagged *Show on homepage*: `{ categories, countries, regions, cities, tags }` |

## 4. Departures

### Departures

`GET /departures?activityId=12&status=OPEN&from=2026-11-01`

```json
{
  "data": [{
    "id": 7, "activityId": 12,
    "startDate": "2026-11-01", "endDate": "2026-11-21",
    "capacity": 12, "availableSpots": 10, "price": 1350, "status": "OPEN",
    "activity": { "id": 12, "title": "Poon Hill Sunrise Trek", "slug": "poon-hill-sunrise-trek" }
  }],
  "pagination": { ... }
}
```

- `availableSpots` is the number of seats left. The agency keeps it up to date in the dashboard; Wepilo doesn't take bookings.
- `status` is `OPEN`, `FULL` or `DELAYED`. `FULL` follows `availableSpots` reaching 0.
- `from` and `to` (YYYY-MM-DD) limit the range by start date. Without them, past departures are returned too.
- To let a traveller ask about a date, send an enquiry with `departureDate` (below).

## 5. Enquiries and newsletter

### Contact and trip enquiry form

`POST /inquiries`

```json
{
  "name": "Priya Nair",
  "email": "priya@example.in",
  "phone": "+91 98000 00000",
  "trip": "Everest Base Camp Trek",
  "departureDate": "2026-11-01",
  "travellers": 2,
  "message": "Is the trek suitable for first-timers?"
}
```

`name`, `email` and `message` are required. `trip` is free text, usually the trip title when the form sits on a trip page. `departureDate` and `travellers` are optional, for a "ask about this date" form.

Wepilo doesn't store enquiries. Each one is emailed straight to the addresses the agency chose under **Settings → Email** (the owner's address if none), with the traveller as Reply-To, so the agency answers from the email it already uses. Returns `202 { "ok": true }`. Errors: `400 VALIDATION`, `429 RATE_LIMITED`.

### Newsletter

| Endpoint | Body / notes |
| --- | --- |
| `POST /newsletter/subscribe` | `{ "email": "reader@example.com" }` |
| `GET /newsletter/unsubscribe/:secret` | Unsubscribe link included in every newsletter email. Shows a confirmation page in a browser. `POST` to the same path is the one-click variant mail apps use. |

## 5b. Site shell and homepage

`GET /site` returns everything a website needs for its shell and homepage in one cacheable request (`Cache-Control: public, max-age=60`). The agency controls it in the dashboard under **Website → Homepage and menus**, so changing the homepage needs no code change.

```json
{
  "company": { "name": "…", "logo": "…", "description": "…", "phone": "…", "address": "…", "website": "…", "email": "…" },
  "seo": { "siteTitle": "…", "description": "…", "ogImage": "…" },
  "social": { "instagram": "https://instagram.com/…", "whatsapp": "+977…" },
  "announcement": { "enabled": true, "text": "Autumn sale", "href": "/trips" },
  "navigation": {
    "header": [{ "label": "Trips", "href": "/trips", "children": [{ "label": "Trekking", "href": "/trips/category/trek" }] }],
    "footer": [{ "title": "Company", "items": [{ "label": "About us", "href": "/about" }] }]
  },
  "homepage": [
    { "id": "hero", "type": "HERO", "title": "…", "subtitle": "…", "image": "…", "ctaLabel": "Browse trips", "ctaHref": "/trips" },
    { "id": "featured_trips", "type": "FEATURED_TRIPS", "title": "Featured trips", "data": [{ "id": 1, "title": "…", "url": "/trips/ebc", "image": "…", "price": 1200 }] }
  ]
}
```

- `homepage` lists only the enabled sections, in the order the agency chose. Render by `type`: `HERO`, `FEATURED_TRIPS`, `DESTINATIONS`, `CATEGORIES`, `TESTIMONIALS`, `LATEST_POSTS`, `NEWSLETTER`, `CUSTOM_TEXT`. List sections carry their content in `data`; `HERO`, `NEWSLETTER` and `CUSTOM_TEXT` carry their text and image directly.
- `navigation` is either built automatically from published content or exactly what the agency typed in. Links use the URL patterns the agency set under **Links and details → Page addresses** (for example `/trips/{slug}`), so they match your routes.
- Only published content appears. The announcement is `null` when switched off.

### Identifying the agency by domain

If the agency verified its domain in **Settings → Domain**, requests from that site's browser (with or without `www`) are recognised from the `Origin` header alone. Server-side requests still send `x-api-key` or `x-tenant-slug`.

## 5c. Languages

`GET /site` includes the agency's languages:

```json
"languages": { "default": "en", "available": ["en", "de", "es"] }
```

Add `?lang=de` to any public `GET` (trips, departures, posts, pages, categories, places, extras, `/site`) to get the German text laid over the original. Fields nobody translated keep the original text, so a page is never half empty. The response carries `Content-Language: de`. Without `lang` nothing changes.

Recommended URLs: the default language at the root (`/trips/kilimanjaro`), every other language under its code (`/de/trips/kilimanjaro`), with `<link rel="alternate" hreflang="…">` tags between them. The starter storefront does this for you.

## 6. Website content

| Endpoint | Description |
| --- | --- |
| `GET /blogs/published?search=&categoryId=` | Paginated list of live posts |
| `GET /blogs/slug/:slug` | One live post, with `blogCategory`, `author` and `writer` |
| `GET /info-pages/slug/:slug` | One published page (About, Terms, Privacy and so on) with its `category` |
| `GET /info-pages/published` | Every published page as `{ id, title, slug, publishedAt, updatedAt }`, for a sitemap or footer |
| `GET /info-page-categories` | Categories for grouping pages in menus or footers |
| `GET /auth/authors/:username` | Public author profile. Authors are staff logins (role Author) with a username, photo and short bio. |
| `GET /team` | Team members |
| `GET /public/team/public` | `{ departments, members }` in one call, for an About page |
| `GET /departments` | Team departments |
| `GET /testimonials`, `GET /public/testimonials/public` | Testimonials |
| `GET /reviews?activityId=` | Paginated trip reviews. Only reviews the agency has published are returned, each with `author`, `rating`, `title`, `text` and `images` (photo URLs). A trip's `averageRating` counts published reviews only. |
| `GET /documents` | Licences and certificates to show for trust |

### Sitemap and structured data

Build `sitemap.xml` from `GET /activities`, `GET /blogs/published` and `GET /info-pages/published` (use `updatedAt` as `lastmod`), plus category and destination pages. With more than one language, list each page once per language with `xhtml:link` alternates, and add matching `hreflang` links in each page's `<head>`. On trip pages, use `tripSeo.schema` as the JSON-LD if the agency wrote one; otherwise build a `TouristTrip` from the trip (itinerary days as an `ItemList`, departures as `Offer`s) and an `FAQPage` from `faq`. Escape `<` as `\u003c` inside the script tag.

### Redirects

Agencies manage URL redirects in the dashboard (Website → Redirects). To apply them, fetch the list at build time or in middleware with a staff session. Mirroring them in your host's redirect config is often simplest.

## 7. Traveller accounts (optional)

To support reviews and wishlists, travellers can register on the agency's site. Sessions use an HTTP-only cookie set by the API, so these calls need `credentials: "include"` and the site must call the API from a domain the cookie can reach.

| Endpoint | Description |
| --- | --- |
| `POST /auth/users/register` | `{ name, email, username, password }` |
| `POST /auth/users/login` | `{ email, password }` |
| `GET /auth/users/me` | Current traveller |
| `POST /auth/logout` | Sign out |
| `POST /reviews` | `{ activityId, rating: 1–5, text? }` (signed in) |
| `GET /wishlists` | The traveller's saved trips |
| `GET /wishlists/check/:activityId` | Whether a trip is saved |
| `PUT /wishlists/:activityId` | Saves the trip, or un-saves it if already saved |

---

## 8. Examples

### Next.js (App Router, server component)

```ts
// lib/wepilo.ts
const BASE = process.env.WEPILO_API_URL ?? "https://wepiloapi.basilpot.com/api/v1";

export async function wepilo<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "x-api-key": process.env.WEPILO_API_KEY!,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    next: { revalidate: 300 }, // re-fetch at most every 5 minutes
  });
  const body = await res.json();
  if (!res.ok) throw Object.assign(new Error(body.error ?? res.statusText), { status: res.status, code: body.code });
  return body as T;
}
```

```tsx
// app/trips/[slug]/page.tsx
import { notFound, permanentRedirect } from "next/navigation";
import { wepilo } from "@/lib/wepilo";

export default async function TripPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const res = await wepilo<{ activity: Trip; redirectTo?: string }>(`/activities/slug/${slug}`).catch((e) => {
    if (e.status === 404) notFound();
    throw e;
  });
  if (res.redirectTo) permanentRedirect(res.redirectTo.replace("/activity/", "/trips/"));

  const { data: departures } = await wepilo<{ data: Departure[] }>(
    `/departures?activityId=${res.activity.id}&status=OPEN&limit=50`,
  );
  const upcoming = departures.filter((d) => d.startDate >= new Date().toISOString().slice(0, 10));

  return <TripView trip={res.activity} departures={upcoming} />;
}
```

### "Ask about this date" form (server action)

```ts
"use server";
import { wepilo } from "@/lib/wepilo";

export async function askAboutDate(form: FormData) {
  try {
    await wepilo("/inquiries", {
      method: "POST",
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        phone: form.get("phone") || undefined,
        trip: form.get("trip"),
        departureDate: form.get("departureDate"),
        travellers: Number(form.get("travellers")) || undefined,
        message: form.get("message"),
      }),
      cache: "no-store",
    });
    return { ok: true };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
```

### Plain browser `fetch` (contact form)

```js
await fetch("https://wepiloapi.basilpot.com/api/v1/inquiries", {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-tenant-slug": "himalaya-trails" },
  body: JSON.stringify({ name, email, message, trip: document.title }),
});
```

## 9. Caching tips

- Trips, pages, posts and taxonomy change rarely. Cache them for 5–15 minutes (ISR or `revalidate`), or rebuild on a schedule.
- Departures (`availableSpots`) change when the agency updates seats, so cache them for a minute at most.
- Never cache `POST` requests.

## 10. Checklist before launch

- [ ] API key stored as a server-side secret (`WEPILO_API_KEY`), never shipped to the browser
- [ ] Trip pages handle `404` and `redirectTo`
- [ ] Past departures filtered out
- [ ] Enquiry forms send `trip` (and `departureDate` when asking about a date)
- [ ] Other languages served under `/{lang}/…` with `?lang=` and hreflang tags
- [ ] Rich-text HTML rendered and sanitised
- [ ] SEO: use `tripSeo.metaTitle` / `metaDescription` / `canonicalUrl` and inject `tripSeo.schema` as JSON-LD
- [ ] `POST /activities/:id/view` called on trip pages
- [ ] Redirects from the dashboard applied

## 11. AI site builders and assistants

- **Plain-text guide:** this document is served at `https://wepiloapi.basilpot.com/llms.txt` for AI coding tools and site builders that read docs from a URL.
- **MCP connector:** builders that accept custom MCP servers (Lovable, Base44 and others) can connect to `https://wepiloapi.basilpot.com/mcp`. The agency signs in with its Wepilo login and gets staff tools for reading and writing its workspace (plus read-only builder tools for website work):
  - `get_website_connection`: the API base URL, the agency slug and the header rules;
  - `get_api_guide`: the sections of this guide;
  - `sample_public_data`: real records in the exact response shape;
  - and, for staff, tools such as `today_summary`, `list_trips`, `get_trip`, `create_trip_draft`, `update_trip` (including translations), `translate_post`, `create_post_draft`, `create_extra`, `list_departures`, `update_departure` and `view_calendar`.

  The connection only informs the builder while it writes code. The published site still talks to this API directly, using `x-tenant-slug` in browser code and `x-api-key` only on the server.

  The write tools cover everything except destructive actions (deletes stay in the Wepilo dashboard). `create_trip_draft` accepts the full trip record: text fields, itinerary with per-day duration/meals/accommodation, altitude chart, FAQs, additional info, group discounts, difficulty, category, group size, guest capacity, maximum altitude, best season, transportation, meals, accommodations, languages, meeting and drop-off points, and price fields. `update_trip` accepts an id plus the same optional fields, so a single field can be changed without rewriting the trip.

