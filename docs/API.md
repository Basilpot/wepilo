# Narfu API: website integration guide

This guide is for developers building an agency's public website on top of Narfu. The website reads trips, departures, pages, posts and the rest from the API, and sends bookings, inquiries and newsletter sign-ups back to it.

- **Base URL (production):** `https://nerfuapi.basilpot.com/api/v1`
- **Base URL (local):** `http://localhost:8787/api/v1`
- **Format:** JSON in and out. Send `Content-Type: application/json` on `POST` requests.

---

## 1. Identify the agency

Every request has to say which agency (tenant) it is for. Use one of these:

| Header | When to use |
| --- | --- |
| `x-api-key: <key>` | **Recommended** for server-side code (Next.js server components, Astro, Nuxt server routes, build scripts). Owners generate the key under Settings → API keys (any paid plan; not during the trial). |
| `x-tenant-slug: <slug>` | Browser-side calls where a secret can't be kept, such as a contact form posting straight from the visitor's browser. The slug is shown under the agency name in the dashboard sidebar. |

Keep the API key on the server. It's shown **once** when generated. Generating a new one revokes the old one immediately.

```bash
curl https://nerfuapi.basilpot.com/api/v1/activities \
  -H "x-api-key: $NARFU_API_KEY"
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
| 402 | `API_ACCESS_INACTIVE`: the agency has no paid plan (new, on trial, or lapsed more than 15 days ago). `PLAN_LIMIT` / `PAYMENT_REQUIRED` only affect dashboard actions. |

### Dates and money

- Timestamps are ISO 8601 strings (`2026-10-19T12:26:16.000Z`).
- Departure `startDate` and `endDate` are plain dates (`2026-11-01`).
- Prices are plain numbers in the agency's currency.

### Images and media

Media fields hold absolute URLs such as `https://nerfuapi.basilpot.com/media/file/<key>`. They're public, cached long-term, and safe to use straight in `<img src>`.

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
| `GET /countries`, `GET /regions`, `GET /cities` | `{ data: [...] }`, sorted by `handle` |
| `GET /trip-categories` | `{ data: [...] }` |
| `GET /featured-tags` | Curated groupings, for example "Best for families" |
| `GET /extras` | Optional add-ons with `price` per person |
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
- No payment is taken. The agency confirms the booking in the dashboard, and that takes the seats. Show travellers something like "Request received, we'll confirm within 24 hours".
- Errors: `404` if the trip or departure isn't found, `409 DEPARTURE_CLOSED`, `409 NOT_ENOUGH_SPOTS`.

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
| `GET /newsletter/unsubscribe/:secret` | Unsubscribe link included in newsletter emails |

## 6. Website content

| Endpoint | Description |
| --- | --- |
| `GET /blogs/published?search=&categoryId=` | Paginated list of live posts |
| `GET /blogs/slug/:slug` | One live post, with `blogCategory`, `author` and `writer` |
| `GET /info-pages/slug/:slug` | One published page (About, Terms, Privacy and so on) with its `category` |
| `GET /info-page-categories` | Categories for grouping pages in menus or footers |
| `GET /auth/authors/:username` | Public author profile |
| `GET /team` | Team members |
| `GET /public/team/public` | `{ departments, members }` in one call, for an About page |
| `GET /departments` | Team departments |
| `GET /testimonials`, `GET /public/testimonials/public` | Testimonials |
| `GET /reviews?activityId=` | Paginated trip reviews |
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
// lib/narfu.ts
const BASE = process.env.NARFU_API_URL ?? "https://nerfuapi.basilpot.com/api/v1";

export async function narfu<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "x-api-key": process.env.NARFU_API_KEY!,
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
import { narfu } from "@/lib/narfu";

export default async function TripPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const res = await narfu<{ activity: Trip; redirectTo?: string }>(`/activities/slug/${slug}`).catch((e) => {
    if (e.status === 404) notFound();
    throw e;
  });
  if (res.redirectTo) permanentRedirect(res.redirectTo.replace("/activity/", "/trips/"));

  const { data: departures } = await narfu<{ data: Departure[] }>(
    `/departures?activityId=${res.activity.id}&status=OPEN&limit=50`,
  );
  const upcoming = departures.filter((d) => d.startDate >= new Date().toISOString().slice(0, 10));

  return <TripView trip={res.activity} departures={upcoming} />;
}
```

### Booking form (server action)

```ts
"use server";
import { narfu } from "@/lib/narfu";

export async function requestBooking(form: FormData) {
  try {
    const { booking } = await narfu<{ booking: { id: number } }>("/bookings", {
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
await fetch("https://nerfuapi.basilpot.com/api/v1/inquiries", {
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

- [ ] API key stored as a server-side secret (`NARFU_API_KEY`), never shipped to the browser
- [ ] Trip pages handle `404` and `redirectTo`
- [ ] Past departures filtered out
- [ ] Booking form explains that bookings are confirmed by the agency
- [ ] Rich-text HTML rendered and sanitised
- [ ] SEO: use `tripSeo.metaTitle` / `metaDescription` / `canonicalUrl` and inject `tripSeo.schema` as JSON-LD
- [ ] `POST /activities/:id/view` called on trip pages
- [ ] Redirects from the dashboard applied
