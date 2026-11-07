# Wepilo

Wepilo is a multi-tenant backend for travel agencies. Each agency (a **tenant**) runs its trips, departures, bookings, inquiries and website content from one dashboard, and its public website reads everything through the Wepilo API.

```
apps/
  api/        Hono API on Cloudflare Workers · D1 (SQLite) via Drizzle · R2 for media
  dashboard/  React + Vite + shadcn/ui admin app, served by a Worker that proxies /api
  storefront/ Hono + JSX Worker that renders an agency's public site from the API (preview and starting point)
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
pnpm --filter @wepilo/api db:migrate:local

# 3. Run both apps (two terminals, or `pnpm dev` for both)
pnpm dev:api        # http://localhost:8787
pnpm dev:dashboard  # http://localhost:5173  (proxies /api and /media/file to :8787)
pnpm dev:storefront # http://localhost:5176/{workspace-slug}  (reads the API at :8787)
```

Open http://localhost:5173/signup to create a workspace. A new workspace is locked behind the paywall until it pays the $1 trial. See [Billing](#billing-dodo-payments) for testing that locally.

### Useful scripts

| Command | What it does |
| --- | --- |
| `pnpm typecheck` | Type-check both apps |
| `pnpm --filter @wepilo/api test` | API tests (Vitest inside the Workers runtime, real D1 migrations, no real email) |
| `pnpm build` | Build both apps |
| `pnpm --filter @wepilo/api db:generate` | Generate a migration after editing `apps/api/src/db/schema.ts` |
| `pnpm --filter @wepilo/api db:migrate:local` | Apply migrations to the local D1 database |
| `pnpm --filter @wepilo/api db:migrate:remote` | Apply migrations to the production D1 database |
| `pnpm --filter @wepilo/api admin:create -- --email you@x.com --name "You"` | Create a platform admin, or reset their password (prompts for it; add `--remote` for production) |

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

## Storefront

`apps/storefront` is a small server-rendered site that shows an agency's content the way its visitors would see it: home page sections, trips, destinations, journal, pages and an enquiry form. It only reads the same public API a website developer would, so it doubles as a worked example.

- **Preview any agency:** open `/{workspace-slug}`. The dashboard's **Preview site** button does this. The preview is marked `noindex`.
- **One agency on its own domain:** set `TENANT_SLUG` in `apps/storefront/wrangler.jsonc` and the site is served from the root.
- **Needs an active plan:** the public API is closed to workspaces on a trial or without a plan, so the preview says the site isn't live yet.
- **Settings it follows:** homepage sections, menus, announcement, social links and currency all come from the dashboard.
- Deploy with `pnpm deploy:storefront`. Set `VITE_STOREFRONT_URL` for the dashboard build so the Preview button points at it.

## Deploying

```bash
pnpm deploy:api        # applies remote D1 migrations, then deploys Worker "wepilo-api-production"
pnpm deploy:dashboard  # builds the SPA, then deploys Worker "wepilo-dashboard"
pnpm --filter @wepilo/api admin:create -- --email you@x.com --name "You" --remote   # first platform admin
```

Use these scripts rather than `pnpm deploy`. That is a built-in pnpm command, not a script, so it doesn't deploy anything to Cloudflare.

| | Worker | Domain |
| --- | --- | --- |
| API | `wepilo-api-production` (`--env production`) | `wepiloapi.basilpot.com` |
| Dashboard | `wepilo-dashboard` | `wepilo.basilpot.com` |

The D1 database (`narfu-db`) and R2 bucket (`narfu-media`) keep their original names, because they hold data and can't be renamed.

**Secrets live on the Worker.** A new Worker name starts with none, so set them once per Worker with `wrangler secret put NAME --env production`, run from `apps/api` (see [Environment](#environment)).

The dashboard Worker serves the built SPA and forwards `/api/*` to the API host, so staff cookies stay first-party on the dashboard domain.

## AI connector (MCP)

The API Worker also serves a remote MCP server at `/mcp` (production: `https://wepiloapi.basilpot.com/mcp`). One connector works in Claude, ChatGPT, Cursor and AI site builders such as Lovable and Base44.

- **Sign-in:** OAuth 2.1 with dynamic client registration (`@cloudflare/workers-oauth-provider`, wrapping the Worker in `apps/api/src/index.ts`).
  - `/oauth/authorize` parks the request in KV and sends the person to the dashboard's `/connect` page.
  - On that page they sign in with their Wepilo login and choose Allow.
  - Each connection belongs to one staff login and keeps that role's permissions.
- **Tools** (`apps/api/src/mcp/`):
  - They call the REST API in-process with a short-lived staff token, so role checks, the paywall, validation and plan limits are the same as in the dashboard.
  - Staff tools read everything and make safe changes only: inquiry status, confirm/complete/cancel bookings, add or edit departures, and trips and posts created as hidden drafts.
  - Nothing publishes, deletes, emails travellers, or touches billing, staff or API keys.
  - Website-builder tools explain how to connect a public site to the API.
- **Storage:** OAuth grants, tokens and pending requests live in the `OAUTH_KV` namespace (`wepilo-oauth`, bound in `apps/api/wrangler.jsonc`).
- **Managing connections:** people see and disconnect their connected apps in Settings → API keys → Connected AI apps.
- **Local testing:** run both apps, then point MCP Inspector (`npx @modelcontextprotocol/inspector`) at `http://localhost:8787/mcp`.

`/llms.txt` serves `docs/API.md` as plain text for AI coding tools.

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
2. Webhook: `https://wepiloapi.basilpot.com/api/v1/billing/webhook` with `payment.succeeded` and all `subscription.*` events. Put its signing secret in `DODO_WEBHOOK_SECRET`.
3. Customer portal: set the return URL to the dashboard's `/settings/billing`.
4. Production secrets: `wrangler secret put DODO_API_KEY --env production` (and the rest).

**Testing locally.** Dodo can't reach `localhost`. Either expose the API with `cloudflared tunnel --url http://localhost:8787` and use that URL as a test-mode webhook, or send signed test events yourself (Standard Webhooks: `webhook-id`, `webhook-timestamp`, `webhook-signature: v1,<base64 HMAC-SHA256 of "id.timestamp.body">`). Trigger the expiry cron with `wrangler dev --test-scheduled`, then `curl "localhost:8787/__scheduled?cron=0+*+*+*+*"`.

## Platform admin

Wepilo's own team works at `/admin` on the dashboard domain. It has its own login and cookie, separate from any agency workspace.

- **Create a workspace** for an enterprise deal: company, slug, owner name and email, plan (any plan, Enterprise included) and an end date (Enterprise can have none). These workspaces are **managed** (`billing_mode = MANUAL`): no $1 trial or checkout, and the dashboard and website API stay on until the end date. Afterwards the usual expiry email and 15-day API grace period apply.
- **Hand it over** with a one-time setup link (valid 7 days). The admin can email it from Wepilo or copy it and send it themselves. Issuing a new link cancels the old one. When the client uses it, they choose a password and sign in as the owner.
- **Open as owner** signs the admin's browser into the workspace as its owner for one hour, for example to load trips before the handover. A banner shows while this is active.
- **Change** the plan, end date, owner email or internal notes, or **suspend** the workspace (everyone is signed out and the website API stops).
- Every admin action is logged on the workspace page.

If a managed workspace later subscribes through Dodo, the subscription takes over and the workspace becomes self-serve again.

Create the first admin with `admin:create` (see [Useful scripts](#useful-scripts)). After that, admins can add each other under **Admins**.

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
