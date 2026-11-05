# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary user: the owner, or one of a few staff, at a small trekking or tour agency (for example in Nepal or Peru). They are not very technical and usually work on a laptop between customer calls. Their daily jobs are answering new inquiries fast, confirming bookings, keeping departure dates and seats current, and updating trips and website content.

Secondary users: staff logins with narrower roles (Admin, Manager, Editor), blog authors, and Wepilo platform admins in the separate `/admin` console.

## Product Purpose

Wepilo runs a travel agency's sales and its website from one dashboard. That covers trips, departure dates and seats, bookings, inquiries, blog posts, pages, media, team and marketing content. The agency's own public website reads all of it through the Wepilo content API. Success means an agency can publish a trip, take a booking and answer a lead without help.

## Positioning

One place for sales and site. Trips, departures, bookings and inquiries live next to the agency's whole website content, and the agency's own site reads it through the API. There is no booking marketplace and no commission. Bookings are reservation requests; the agency collects payment itself.

## Operating Context

- Multi-tenant SaaS. Each agency is a workspace with a slug.
- New workspaces sit behind a paywall until they pay a one-time $1 trial (3 days, no auto-renew). Paid plans (Starter, Growth, Scale, Enterprise) come through Dodo Payments.
- Inquiries are often answered on WhatsApp, as well as by email and phone.
- Trips come in two formats: a day-by-day itinerary (an 18-step guided editor) or a simple page.

## Capabilities and Constraints

- Stack: React 19 + Vite + Tailwind v4 + shadcn/ui, with TanStack Query and react-router. Served by a Cloudflare Worker that proxies `/api`.
- Currency is shown as USD.
- Copy rule: labels, buttons, menu items and headers stay short. Descriptions, hints, empty-state text and confirmations are detailed and explain what to do next.

## Brand Commitments

- Name: Wepilo. Each agency's own name and logo appear in its workspace.
- Keep the green primary colour.
- Use the operating system's default UI font (system-ui stack). Load no web fonts.
- Light and dark mode must both stay supported.
- Binding UI references from the owner:
  - Icons from the Pikaicons free set (`@pikaicons/react`, `@pikaicons/core-free`).
  - Pill buttons modelled on review.basilpot.com `.btn-pill`: fully rounded, inset top highlight, soft drop shadow, 2px lift on hover.
  - Kobra morphing icons and Kobra UI sounds, with a mute toggle.
  - Micro-interactions in the spirit of reactbits.dev "micro".

## Evidence on Hand

- No real customer testimonials, metrics or logos are in the repo. Do not invent any.

## Product Principles

1. Speed to reply: new inquiries and pending bookings are always one glance away.
2. Plain language: short labels, with descriptions that tell a non-technical owner exactly what happens.
3. Nothing hidden that blocks selling: a trip needs to be published and have a departure before it can be booked, and the UI says so.
4. Calm confidence: every action is reversible or clearly confirmed.
