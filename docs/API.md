# Wepilo API: website integration guide

This guide is for developers building an agency's public website on top of Wepilo. The website reads trips, departures, pages, posts and the rest from the API, and sends bookings, inquiries and newsletter sign-ups back to it.

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
| 429 | `RATE_LIMITED`: too many requests from one visitor. Wait the number of seconds in the `Retry-After` header. Public forms (bookings, inquiries, newsletter) allow about 12 submissions per visitor per 10 minutes. |
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

## 4. Departures and bookings

### Departures

`GET /departures?activityId=12&status=OPEN`

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

- `status` is `OPEN`, `FULL` or `DELAYED`. Only `OPEN` departures accept bookings.
- Past departures are returned too, so filter out `startDate < today` on your side.

### Create a booking

`POST /bookings`

```json
{
  "activityId": 12,
  "departureId": 7,
  "groupSize": 2,
  "name": "Aarav Shah",
  "email": "aarav@example.com",
  "phone": "+977 9800000001",
  "extraIds": [3, 5]
}
```

On success it returns `201 { "booking": { "id": 42, "status": "PENDING", "totalPrice": 2900, ... } }`.

- `totalPrice` is `departure.price × groupSize + Σ(extra.price × groupSize)`, worked out on the server.
- Creating a booking takes no payment. Without online payments the agency confirms it in the dashboard (that takes the seats): show something like "Request received, we'll confirm within 24 hours". With payments on, continue to [Paying for a booking](#paying-for-a-booking).
- `extraIds` must be extras offered on that trip (`400` otherwise). Duplicates are counted once. `groupSize` is 1 to 200.
- The agency is emailed about each new request, with the traveller's address as Reply-To.
- Errors: `404` if the trip or departure isn't found, `409 DEPARTURE_CLOSED` (full, delayed, or already started), `409 NOT_ENOUGH_SPOTS`, `429 RATE_LIMITED`.

### Paying for a booking

If the agency has switched on payments (`GET /payments/options` says `online: true`), send the traveller to pay right after creating the booking. The booking response includes a secret `publicToken` (it is never shown in the dashboard or returned again), plus the `currency` the price is in. Keep both in your server session; the token is what proves this traveller owns the booking.

`GET /payments/options` returns:

```json
{ "currency": "EUR", "stripe": true, "bankTransfer": { "instructions": "IBAN …" }, "depositPercent": 25, "online": true }
```

**Card (Stripe)**: `POST /payments/checkout`

```json
{
  "bookingId": 42,
  "token": "bk_…",
  "kind": "DEPOSIT",
  "successUrl": "https://youragency.com/thanks?booking=42",
  "cancelUrl": "https://youragency.com/cart"
}
```

`kind` is `FULL` (default; pays whatever is still due) or `DEPOSIT` (only before anything is paid, and only if `depositPercent` is set). The amount is always worked out on the server. It returns `{ "url": "https://checkout.stripe.com/…", "amountMinor": 25000, "currency": "EUR", "kind": "DEPOSIT" }`: redirect the traveller to `url`. `successUrl` and `cancelUrl` must be pages on the agency's own website (the address saved under Business profile → Website, or a verified custom domain). Over HTTPS only, except `localhost` in development.

The booking is marked paid when Stripe confirms, usually within seconds, and the agency is emailed. Depending on the agency's setting the booking is confirmed automatically or waits for them. Don't treat the redirect to `successUrl` as proof of payment; show "payment received, we'll confirm shortly" and let the agency's confirmation email do the rest.

**Bank transfer**: `POST /payments/bank-transfer` with `{ "bookingId", "token", "kind" }` returns `{ "reference": "WP-42", "amountMinor": …, "currency": "…", "instructions": "…" }`. Show the instructions and reference. The agency marks it received in the dashboard once the money arrives. Calling it again returns the same pending payment.

Errors: `404` for an unknown booking or wrong token (the same answer for both), `409 PAYMENTS_OFF`, `409 ALREADY_PAID`, `409 BOOKING_CLOSED` (cancelled or completed), `400` for a `successUrl` that isn't the agency's site, `502 CHECKOUT_FAILED` when the payment provider refuses, `429 RATE_LIMITED`.

## 5. Inquiries and newsletter

### Contact / inquiry form

`POST /inquiries`

```json
{
  "name": "Priya Nair",
  "email": "priya@example.in",
  "phone": "+91 98000 00000",
  "trip": "Everest Base Camp Trek",
  "message": "Is the trek suitable for first-timers?"
}
```

`name`, `email` and `message` are required. `trip` is free text, usually the trip title when the form sits on a trip page. Returns `201 { inquiry }`.

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

## 6. Website content

| Endpoint | Description |
| --- | --- |
| `GET /blogs/published?search=&categoryId=` | Paginated list of live posts |
| `GET /blogs/slug/:slug` | One live post, with `blogCategory`, `author` and `writer` |
| `GET /info-pages/slug/:slug` | One published page (About, Terms, Privacy and so on) with its `category` |
| `GET /info-page-categories` | Categories for grouping pages in menus or footers |
| `GET /auth/authors/:username` | Public author profile. Authors are staff logins (role Author) with a username, photo and short bio. |
| `GET /team` | Team members |
| `GET /public/team/public` | `{ departments, members }` in one call, for an About page |
| `GET /departments` | Team departments |
| `GET /testimonials`, `GET /public/testimonials/public` | Testimonials |
| `GET /reviews?activityId=` | Paginated trip reviews. Only reviews the agency has published are returned, each with `author`, `rating`, `title`, `text` and `images` (photo URLs). A trip's `averageRating` counts published reviews only. |
| `GET /documents` | Licences and certificates to show for trust |

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

### Booking form (server action)

```ts
"use server";
import { wepilo } from "@/lib/wepilo";

export async function requestBooking(form: FormData) {
  try {
    const { booking } = await wepilo<{ booking: { id: number } }>("/bookings", {
      method: "POST",
      body: JSON.stringify({
        activityId: Number(form.get("activityId")),
        departureId: Number(form.get("departureId")),
        groupSize: Number(form.get("groupSize")),
        name: form.get("name"),
        email: form.get("email"),
        phone: form.get("phone"),
      }),
      cache: "no-store",
    });
    return { ok: true, bookingId: booking.id };
  } catch (e: any) {
    if (e.code === "NOT_ENOUGH_SPOTS") return { ok: false, error: "Not enough seats left on this date." };
    if (e.code === "DEPARTURE_CLOSED") return { ok: false, error: "This date is no longer open for booking." };
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
- Departures (`availableSpots`) change with bookings, so cache them for a minute at most, or fetch them on demand on the booking step.
- Never cache `POST` requests.

## 10. Checklist before launch

- [ ] API key stored as a server-side secret (`WEPILO_API_KEY`), never shipped to the browser
- [ ] Trip pages handle `404` and `redirectTo`
- [ ] Past departures filtered out
- [ ] Booking form explains that bookings are confirmed by the agency
- [ ] Rich-text HTML rendered and sanitised
- [ ] SEO: use `tripSeo.metaTitle` / `metaDescription` / `canonicalUrl` and inject `tripSeo.schema` as JSON-LD
- [ ] `POST /activities/:id/view` called on trip pages
- [ ] Redirects from the dashboard applied

## 11. AI site builders and assistants

- **Plain-text guide:** this document is served at `https://wepiloapi.basilpot.com/llms.txt` for AI coding tools and site builders that read docs from a URL.
- **MCP connector:** builders that accept custom MCP servers (Lovable, Base44 and others) can connect to `https://wepiloapi.basilpot.com/mcp`. The agency signs in with its Wepilo login. The builder's AI then gets three read-only tools:
  - `get_website_connection`: the API base URL, the agency slug and the header rules;
  - `get_api_guide`: the sections of this guide;
  - `sample_public_data`: real records in the exact response shape.

  The connection only informs the builder while it writes code. The published site still talks to this API directly, using `x-tenant-slug` in browser code and `x-api-key` only on the server.

