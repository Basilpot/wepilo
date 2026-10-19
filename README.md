# Narfu

Narfu is a multi-tenant backend for travel agencies. Each agency (a **tenant**) runs its trips, departures, bookings, inquiries and website content from one dashboard, and its public website reads everything through the Narfu API.

```
apps/
  api/        Hono API on Cloudflare Workers · D1 (SQLite) via Drizzle · R2 for media
  dashboard/  React + Vite + shadcn/ui admin app, served by a Worker that proxies /api
```

- API integration guide for website developers: [docs/API.md](docs/API.md)
- Dashboard guide for agency staff: [Using the dashboard](#using-the-dashboard) below

---

## Local development

Requirements: Node 20+, pnpm 11, a Cloudflare account (only for deploying).

```bash
pnpm install

# 1. Secrets for the API (never commit this file)
cp apps/api/.dev.vars.example apps/api/.dev.vars
#    set JWT_SECRET to a long random string; the rest can stay as placeholders locally

# 2. Create the local D1 database
pnpm --filter @narfu/api db:migrate:local

# 3. Run both apps (two terminals, or `pnpm dev` for both)
pnpm dev:api        # http://localhost:8787
pnpm dev:dashboard  # http://localhost:5173  (proxies /api and /media/file to :8787)
```

Open http://localhost:5173/signup to create a workspace. A new workspace is locked behind the paywall until it pays the $1 trial. See [Billing](#billing-dodo-payments) for testing that locally.

### Useful scripts

| Command | What it does |
| --- | --- |
| `pnpm typecheck` | Type-check both apps |
| `pnpm build` | Build both apps |
| `pnpm --filter @narfu/api db:generate` | Generate a migration after editing `apps/api/src/db/schema.ts` |
| `pnpm --filter @narfu/api db:migrate:local` | Apply migrations to the local D1 database |
| `pnpm --filter @narfu/api db:migrate:remote` | Apply migrations to the production D1 database |

### Environment

Secrets live in `apps/api/.dev.vars` locally and in Wrangler secrets in production (`wrangler secret put NAME --env production`).

| Secret | Purpose |
| --- | --- |
| `JWT_SECRET` | Signs staff and website-user session cookies |
| `RESEND_API_KEY` | Sends email (password resets, newsletter) |
| `PLATFORM_EMAIL_FROM`, `PLATFORM_SUPPORT_EMAIL` | Sender address and support inbox |
| `DODO_API_KEY`, `DODO_WEBHOOK_SECRET` | Dodo Payments API key and webhook signing secret (`whsec_…`) |
| `DODO_TRIAL_PRODUCT_ID` | One-time $1 product that unlocks the 3-day trial |
| `DODO_{STARTER,GROWTH,SCALE}_{MONTHLY,ANNUAL}_PRODUCT_ID` | Subscription product per plan and interval (leave out intervals you don't sell) |

Plain variables (`ENVIRONMENT`, `DODO_ENVIRONMENT` (`test_mode` locally, `live_mode` in production), `COOKIE_DOMAIN`, `API_BASE_URL`, `DASHBOARD_URL`, `SITE_URL`) are in `apps/api/wrangler.jsonc`, with production overrides under `env.production`.

`.gitignore` excludes `.dev.vars*`, `.env*`, keys and local Wrangler state. Only `.dev.vars.example` is tracked.

## Deploying

```bash
# API
pnpm --filter @narfu/api db:migrate:remote
cd apps/api && pnpm wrangler deploy --env production

# Dashboard
cd apps/dashboard && pnpm build && pnpm wrangler deploy
```

The dashboard Worker serves the built SPA and forwards `/api/*` to the API host, so staff cookies stay first-party on the dashboard domain.

## Plans and limits

Limits are defined once in `apps/api/src/lib/plans.ts` (`PLANS`). The Billing page reads them from `GET /tenant/billing`, and prices come live from Dodo.

| | Starter | Growth | Scale | Enterprise |
| --- | --- | --- | --- | --- |
| Trips | 45 | Unlimited | Unlimited | Unlimited |
| Posts (excluding trash) | 200 | Unlimited | Unlimited | Unlimited |
| Staff logins | 2 | 10 | 25 | Unlimited |
| Media storage | 5 GB | 25 GB | 100 GB | Unlimited |
| Website API | ✓ | ✓ | ✓ | ✓ |

Going over a limit returns `402` with `code: "PLAN_LIMIT"`, and the dashboard shows a toast with a "See plans" link.

## Billing (Dodo Payments)

**Lifecycle**

1. **Sign up → locked.** A new workspace can only see the paywall. Every other API call returns `402 PAYMENT_REQUIRED`.
2. **$1 trial.** The owner picks a plan and pays a one-time $1 (`DODO_TRIAL_PRODUCT_ID`). The `payment.succeeded` webhook unlocks that plan's dashboard for **3 days**.
   - Nothing renews. Card details aren't used again.
   - One trial per person, matched by normalised owner email across workspaces.
   - The website API stays off during the trial.
3. **Trial ends → locked.** An hourly cron (`0 * * * *`) emails the owner once: "your trial has ended, choose your plan".
4. **Subscription.** The owner buys Starter, Growth or Scale (monthly or annual) through Dodo checkout. It renews automatically.
   - `subscription.*` webhooks keep access in sync.
   - Plan switches use Dodo's change-plan with proration.
   - "Manage billing" opens Dodo's customer portal (cancel, card, invoices).
5. **Subscription lapses** (failed, cancelled or expired). The dashboard locks right away and the owner gets the same email. The **website API keeps working for 15 days** (`API_GRACE_DAYS`), so the agency's site doesn't go down mid-renewal.

**Dodo setup**

1. Products: one **one-time** product at $1 for the trial, plus one **subscription** product per plan and interval. Set **no trial** on the subscription products; checkout also forces `trial_period_days: 0`.
2. Webhook: `https://nerfuapi.basilpot.com/api/v1/billing/webhook` with `payment.succeeded` and all `subscription.*` events. Put its signing secret in `DODO_WEBHOOK_SECRET`.
3. Customer portal: set the return URL to the dashboard's `/settings/billing`.
4. Production secrets: `wrangler secret put DODO_API_KEY --env production` (and the rest).

**Testing locally.** Dodo can't reach `localhost`. Either expose the API with `cloudflared tunnel --url http://localhost:8787` and use that URL as a test-mode webhook, or send signed test events yourself (Standard Webhooks: `webhook-id`, `webhook-timestamp`, `webhook-signature: v1,<base64 HMAC-SHA256 of "id.timestamp.body">`). Trigger the expiry cron with `wrangler dev --test-scheduled`, then `curl "localhost:8787/__scheduled?cron=0+*+*+*+*"`.

## Known limitations (by design for now)

- Travellers can't pay online. `POST /bookings` creates a **pending** booking that staff confirm by hand.
- Few transactional emails. Booking, inquiry and support notifications aren't sent yet.
- Seats are only taken when staff **confirm** a booking, so pending bookings can add up to more than a departure's capacity.

---

## Using the dashboard

A typical setup for a new agency:

1. **Business profile** (Settings → Business profile). Add your name, logo, description, phone and address. These appear on your site and in emails.
2. **Destinations and trip categories.** Add the countries, regions and cities you operate in, plus categories like *Trekking* or *Day tours*. Use *Show on homepage* to feature them.
3. **Trips.** Choose **Multi-day itinerary** for structured trips (day-by-day plan, altitude, meals, stays) or **Simple page** for short experiences. The editor tracks how complete each trip is. Save as a draft, or **Publish** to make it live on the website.
4. **Departures.** Add dated departures with capacity and price for each trip. Travellers book against a departure.
5. **Bookings.** New bookings from your site arrive as *Pending*. Confirming one takes its seats from the departure, and cancelling gives them back.
6. **Inquiries.** Contact-form messages land here. Move each through *New → In progress → Resolved/Closed*.
7. **Website content.** Pages, Posts (blog), Content categories, Media library and Redirects (old URL → new URL).
8. **About us and marketing.** Team members, Departments, Authors, Testimonials, Reviews, Documents (licences and certificates) and Newsletter subscribers.
9. **Staff logins** (Settings). Invite colleagues with a role:
   - **Owner**: everything.
   - **Admin**: everything except billing and API keys.
   - **Manager**: trips, departures, bookings and content.
   - **Editor**: posts, pages and media only.
10. **API key** (Settings → API keys, any paid plan). Generate a key for your website developer and give them [docs/API.md](docs/API.md).

Press <kbd>⌘K</kbd> / <kbd>Ctrl K</kbd> anywhere to jump to a page.
