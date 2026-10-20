import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "@/env";
import { appContext, requirePaidAccess, type AppVariables } from "@/middleware/context";
import { getDb } from "@/db";
import { sendExpiryNotices } from "@/lib/billing";
import { handleRouteError } from "@/lib/http";
import { authRoutes } from "@/routes/auth";
import { tenantRoutes } from "@/routes/tenant";
import { billingRoutes } from "@/routes/billing";
import { platformRoutes } from "@/routes/platform";
import {
  catalogRoutes,
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

const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();

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

// Media files are public (R2-backed with immutable cache)
app.route("/media/file", mediaFileRoutes);

app.use("/api/v1/*", appContext);
app.use("/api/v1/*", requirePaidAccess);

const v1 = new Hono<{ Bindings: Env; Variables: AppVariables }>();

v1.route("/auth", authRoutes);
v1.route("/tenant", tenantRoutes);
v1.route("/billing", billingRoutes);
// Wepilo's own team: create and hand over workspaces. Separate login and cookie.
v1.route("/platform", platformRoutes);

v1.route("/", catalogRoutes);
v1.route("/countries", countryRoutes);
v1.route("/regions", regionRoutes);
v1.route("/cities", cityRoutes);
v1.route("/trip-categories", tripCategoryRoutes);
v1.route("/featured-tags", featuredTagRoutes);
v1.route("/extras", extraRoutes);
v1.route("/departures", departureRoutes);
v1.route("/bookings", bookingRoutes);
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
v1.route("/public", publicRoutes);

app.route("/api/v1", v1);

app.notFound((c) => c.json({ error: "Not found" }, 404));

export default {
  fetch: app.fetch,
  // Cron (wrangler.jsonc → triggers.crons): email owners whose trial or plan just ended.
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      sendExpiryNotices(env, getDb(env)).then((r) => console.log("expiry notices", JSON.stringify(r))),
    );
  },
} satisfies ExportedHandler<Env>;
