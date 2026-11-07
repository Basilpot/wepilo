import { Hono } from "hono";
import { and, eq, gte } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AppEnv } from "@/types";
import { requireStaff, requireTenant } from "@/middleware/context";

type Step = { key: string; title: string; hint: string; done: boolean; to: string };

/** A short, honest checklist computed from what the workspace actually has. Nothing is stored. */
export const onboardingRoutes = new Hono<AppEnv>().get("/", requireStaff(), requireTenant(), async (c) => {
  const db = c.get("db");
  const tenantId = c.get("tenantId");
  const today = new Date().toISOString().slice(0, 10);
  const [tenant, published, upcoming, staff, payments, email] = await Promise.all([
    db.query.tenants.findFirst({
      where: eq(schema.tenants.id, tenantId),
      columns: { companyLogo: true, companyDescription: true, phone: true, apiKeyHash: true, siteConfig: true, customDomainVerifiedAt: true, website: true },
    }),
    db.$count(schema.activities, and(eq(schema.activities.tenantId, tenantId), eq(schema.activities.status, "PUBLISHED"))),
    db.$count(schema.departures, and(eq(schema.departures.tenantId, tenantId), gte(schema.departures.startDate, today))),
    db.$count(schema.tenantStaff, and(eq(schema.tenantStaff.tenantId, tenantId), eq(schema.tenantStaff.isActive, true))),
    db.query.tenantPaymentSettings.findFirst({ where: eq(schema.tenantPaymentSettings.tenantId, tenantId), columns: { stripeEnabled: true, bankEnabled: true } }),
    db.query.tenantEmailConfig.findFirst({ where: eq(schema.tenantEmailConfig.tenantId, tenantId), columns: { inquiryRecipients: true, verifiedAt: true } }),
  ]);

  const steps: Step[] = [
    { key: "profile", title: "Finish your business profile", hint: "Add a logo, a short description and a phone number.", done: Boolean(tenant?.companyLogo && tenant.companyDescription && tenant.phone), to: "/settings" },
    { key: "trip", title: "Publish your first trip", hint: "Travellers can only see published trips.", done: published > 0, to: "/trips/new" },
    { key: "departure", title: "Add an upcoming departure", hint: "Departures are the dates people can book.", done: upcoming > 0, to: "/departures" },
    { key: "homepage", title: "Set up your homepage and menus", hint: "Choose the sections your site shows.", done: Boolean(tenant?.siteConfig), to: "/website" },
    { key: "api", title: "Create an API key for your website", hint: "Your developer needs it to load your content.", done: Boolean(tenant?.apiKeyHash), to: "/settings/api-keys" },
    { key: "alerts", title: "Choose where enquiries are sent", hint: "Pick the inbox that gets booking and inquiry alerts.", done: Boolean(email?.inquiryRecipients?.length || email?.verifiedAt), to: "/settings/email" },
    { key: "payments", title: "Get paid online", hint: "Connect Stripe or offer bank transfer.", done: Boolean(payments?.stripeEnabled || payments?.bankEnabled), to: "/settings/payments" },
    { key: "domain", title: "Connect your own domain", hint: "Optional. Use your site's address with Wepilo.", done: Boolean(tenant?.customDomainVerifiedAt), to: "/settings/website" },
    { key: "team", title: "Invite a teammate", hint: "Optional. Give colleagues their own logins.", done: staff > 1, to: "/settings/staff" },
  ];
  return c.json({ steps, completed: steps.filter((s) => s.done).length, total: steps.length });
});
