import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "@/env";
import { appContext, requirePaidAccess, type AppVariables } from "@/middleware/context";
import { handleRouteError } from "@/lib/http";
import { authRoutes } from "@/routes/auth";
import { tenantRoutes } from "@/routes/tenant";
import { billingRoutes } from "@/routes/billing";
import { emailSettingsRoutes } from "@/routes/email-settings";
import { paymentRoutes } from "@/routes/payments";
import { domainRoutes } from "@/routes/tenant-domain";
import { onboardingRoutes } from "@/routes/onboarding";
import { siteRoutes, savedSectionRoutes, templateRoutes } from "@/routes/site";
import { platformRoutes } from "@/routes/platform";
import {
  catalogRoutes,
  locationRoutes,
  countryRoutes,
  regionRoutes,
  cityRoutes,
  tripCategoryRoutes,
  featuredTagRoutes,
  extraRoutes,
} from "@/routes/catalog";
import { departureRoutes, bookingRoutes, inquiryRoutes } from "@/routes/bookings";
import {
  reviewRoutes,
  wishlistRoutes,
  testimonialRoutes,
  newsletterRoutes,
} from "@/routes/engagement";
import {
  blogRoutes,
  infoPageRoutes,
  infoPageCategoryRoutes,
  mediaRoutes,
  mediaFileRoutes,
  redirectRoutes,
  teamRoutes,
  departmentRoutes,
  documentRoutes,
} from "@/routes/content";
import { supportRoutes, authorRoutes, publicRoutes } from "@/routes/support";
import { reviewLinkRoutes, publicReviewRoutes } from "@/routes/review-collection";
import { connectRoutes, oauthAuthorizeRoutes } from "@/mcp/oauth";
import apiGuide from "../../../docs/API.md";

export const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();

app.use(
  "*",
  cors({
    origin: (origin) => origin ?? "*",
    credentials: true,
    allowHeaders: ["Content-Type", "x-api-key", "x-tenant-slug"],
    exposeHeaders: ["Location"],
  }),
);

app.onError((err, c) => handleRouteError(c, err));

app.get("/health", (c) => c.json({ ok: true, service: "wepilo-api" }));

// The website API guide as plain text, for AI site builders and coding assistants.
app.get("/llms.txt", (c) =>
  c.text(`# Wepilo website API\n\nAPI base URL: ${c.env.API_BASE_URL}/api/v1\n\n${apiGuide}`, 200, {
    "Cache-Control": "public, max-age=3600",
  }),
);

// AI connector (MCP over OAuth): the authorization endpoint; the token, registration and
// discovery endpoints are served by the OAuth provider wrapper in src/index.ts.
app.route("/oauth", oauthAuthorizeRoutes);

// Media files are public (R2-backed with immutable cache)
app.route("/media/file", mediaFileRoutes);

app.use("/api/v1/*", appContext);
app.use("/api/v1/*", requirePaidAccess);

const v1 = new Hono<{ Bindings: Env; Variables: AppVariables }>();

v1.route("/auth", authRoutes);
v1.route("/tenant/email-settings", emailSettingsRoutes);
v1.route("/tenant/domain", domainRoutes);
v1.route("/tenant/onboarding", onboardingRoutes);
v1.route("/tenant", tenantRoutes);
v1.route("/billing", billingRoutes);
// Wepilo's own team: create and hand over workspaces. Separate login and cookie.
v1.route("/platform", platformRoutes);

v1.route("/", catalogRoutes);
v1.route("/locations", locationRoutes);
v1.route("/countries", countryRoutes);
v1.route("/regions", regionRoutes);
v1.route("/cities", cityRoutes);
v1.route("/trip-categories", tripCategoryRoutes);
v1.route("/featured-tags", featuredTagRoutes);
v1.route("/extras", extraRoutes);
v1.route("/departures", departureRoutes);
v1.route("/bookings", bookingRoutes);
v1.route("/payments", paymentRoutes);
v1.route("/site", siteRoutes);
v1.route("/saved-sections", savedSectionRoutes);
v1.route("/templates", templateRoutes);
v1.route("/inquiries", inquiryRoutes);
v1.route("/reviews", reviewRoutes);
v1.route("/wishlists", wishlistRoutes);
v1.route("/testimonials", testimonialRoutes);
v1.route("/newsletter", newsletterRoutes);
v1.route("/blogs", blogRoutes);
v1.route("/info-pages", infoPageRoutes);
v1.route("/info-page-categories", infoPageCategoryRoutes);
v1.route("/media", mediaRoutes);
v1.route("/redirects", redirectRoutes);
v1.route("/team", teamRoutes);
v1.route("/departments", departmentRoutes);
v1.route("/documents", documentRoutes);
v1.route("/support", supportRoutes);
v1.route("/authors", authorRoutes);
v1.route("/review-links", reviewLinkRoutes);
v1.route("/public/review", publicReviewRoutes);
v1.route("/public", publicRoutes);
v1.route("/connect", connectRoutes);

app.route("/api/v1", v1);

app.notFound((c) => c.json({ error: "Not found" }, 404));
