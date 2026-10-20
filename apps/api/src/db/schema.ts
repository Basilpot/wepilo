import { sqliteTable, text, integer, real, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
};

// ─── Tenancy & auth ──────────────────────────────────────────────────────────

export const tenants = sqliteTable(
  "tenants",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull().unique(),
    password: text("password").notNull(),
    companyName: text("company_name"),
    companyLogo: text("company_logo"),
    website: text("website"),
    companyDescription: text("company_description"),
    phone: text("phone"),
    address: text("address"),
    slug: text("slug").notNull().unique(),
    customDomain: text("custom_domain").unique(),
    status: text("status", { enum: ["PENDING", "ACTIVE", "SUSPENDED", "CANCELLED"] })
      .notNull()
      .default("PENDING"),
    plan: text("plan", {
      enum: ["STARTER", "GROWTH", "SCALE", "ENTERPRISE"],
    })
      .notNull()
      .default("STARTER"),
    /** Access ends at this moment. Null = no end (manual Enterprise deals). */
    planExpiresAt: integer("plan_expires_at", { mode: "timestamp_ms" }),
    trialUsedAt: integer("trial_used_at", { mode: "timestamp_ms" }),
    /** Normalized owner email recorded when the trial is bought, so each person gets one trial. */
    trialEmail: text("trial_email").unique(),
    /** When the "your access ended" email went out for the current expiry; cleared when access is extended. */
    expiryNoticeSentAt: integer("expiry_notice_sent_at", { mode: "timestamp_ms" }),
    /**
     * SELF_SERVE: access comes from the $1 trial or a Dodo subscription.
     * MANUAL: a platform admin set the plan and end date by hand (enterprise deals, comped accounts).
     */
    billingMode: text("billing_mode", { enum: ["SELF_SERVE", "MANUAL"] }).notNull().default("SELF_SERVE"),
    /** Platform-only notes (deal terms, contacts). Never shown to the agency. */
    internalNotes: text("internal_notes"),
    /** Platform admin who created this workspace; null for self sign-ups. */
    createdByAdminId: integer("created_by_admin_id"),
    apiKeyHash: text("api_key_hash").unique(),
    dodoCustomerId: text("dodo_customer_id").unique(),
    siteConfig: text("site_config", { mode: "json" }),
    ...timestamps,
  },
  (t) => [index("tenants_status_idx").on(t.status)],
);

export const tenantStaff = sqliteTable(
  "tenant_staff",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    password: text("password").notNull(),
    role: text("role", { enum: ["OWNER", "ADMIN", "MANAGER", "EDITOR"] })
      .notNull()
      .default("EDITOR"),
    permissions: text("permissions", { mode: "json" }),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("tenant_staff_email_uidx").on(t.tenantId, t.email),
    index("tenant_staff_tenant_idx").on(t.tenantId),
  ],
);

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name"),
    email: text("email").notNull(),
    username: text("username").notNull(),
    password: text("password").notNull(),
    phone: text("phone"),
    dateOfBirth: text("date_of_birth"),
    emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
    image: text("image"),
    bio: text("bio"),
    meta: text("meta", { mode: "json" }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("users_email_uidx").on(t.tenantId, t.email),
    uniqueIndex("users_username_uidx").on(t.tenantId, t.username),
    index("users_tenant_idx").on(t.tenantId),
  ],
);

export const authors = sqliteTable(
  "authors",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    username: text("username").notNull(),
    name: text("name"),
    email: text("email").notNull(),
    password: text("password").notNull(),
    bio: text("bio"),
    image: text("image"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("authors_username_uidx").on(t.tenantId, t.username),
    uniqueIndex("authors_email_uidx").on(t.tenantId, t.email),
    index("authors_tenant_idx").on(t.tenantId),
  ],
);

/** Wepilo's own team. Not tied to any tenant. */
export const platformAdmins = sqliteTable("platform_admins", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  password: text("password").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  lastLoginAt: integer("last_login_at", { mode: "timestamp_ms" }),
  ...timestamps,
});

/** Single-use links for staff: account setup (handover) and password reset. Only the hash is stored. */
export const staffAuthTokens = sqliteTable(
  "staff_auth_tokens",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    staffId: integer("staff_id")
      .notNull()
      .references(() => tenantStaff.id, { onDelete: "cascade" }),
    purpose: text("purpose", { enum: ["SETUP", "RESET"] }).notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    usedAt: integer("used_at", { mode: "timestamp_ms" }),
    createdAt: timestamps.createdAt,
  },
  (t) => [index("staff_auth_tokens_staff_idx").on(t.staffId)],
);

/** What platform admins did, per workspace. */
export const platformAuditLog = sqliteTable(
  "platform_audit_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    adminId: integer("admin_id").references(() => platformAdmins.id, { onDelete: "set null" }),
    tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    detail: text("detail", { mode: "json" }),
    createdAt: timestamps.createdAt,
  },
  (t) => [index("platform_audit_log_tenant_idx").on(t.tenantId, t.createdAt)],
);

// ─── Catalog taxonomy ────────────────────────────────────────────────────────

export const locations = sqliteTable(
  "locations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    handle: text("handle").notNull(),
    name: text("name"),
    image: text("image"),
    showOnHomepage: integer("show_on_homepage", { mode: "boolean" }).notNull().default(false),
    translations: text("translations", { mode: "json" }),
    ...timestamps,
  },
  (t) => [uniqueIndex("locations_type_handle_uidx").on(t.tenantId, t.type, t.handle)],
);

export const tripCategories = sqliteTable(
  "trip_categories",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    handle: text("handle").notNull(),
    name: text("name"),
    image: text("image"),
    showOnHomepage: integer("show_on_homepage", { mode: "boolean" }).notNull().default(false),
    translations: text("translations", { mode: "json" }),
    ...timestamps,
  },
  (t) => [uniqueIndex("trip_categories_handle_uidx").on(t.tenantId, t.handle)],
);

export const featuredTags = sqliteTable(
  "featured_tags",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    showOnHomepage: integer("show_on_homepage", { mode: "boolean" }).notNull().default(false),
    order: integer("order").notNull().default(0),
    translations: text("translations", { mode: "json" }),
    ...timestamps,
  },
  (t) => [uniqueIndex("featured_tags_slug_uidx").on(t.tenantId, t.slug)],
);

// ─── Activities (trips) ──────────────────────────────────────────────────────

export const tripSeo = sqliteTable("trip_seo", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
  metaKeywords: text("meta_keywords"),
  metaRobots: text("meta_robots"),
  metaAuthor: text("meta_author"),
  canonicalUrl: text("canonical_url"),
  featuredMedia: text("featured_media"),
  schema: text("schema"),
  ...timestamps,
});

export const activities = sqliteTable(
  "activities",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    title: text("title"),
    slug: text("slug").notNull(),
    // Which editor and site template the trip uses: a day-by-day itinerary,
    // or a single freeform page (day tours, weekend getaways, experiences).
    layout: text("layout", { enum: ["ITINERARY", "PAGE"] })
      .notNull()
      .default("ITINERARY"),
    overview: text("overview"),
    // Long-form body for PAGE trips; overview stays the short summary.
    content: text("content"),
    highlights: text("highlights"),
    inclusions: text("inclusions"),
    exclusions: text("exclusions"),
    itinerary: text("itinerary", { mode: "json" }),
    additionalInfo: text("additional_info", { mode: "json" }),
    faq: text("faq", { mode: "json" }),
    whatToBring: text("what_to_bring", { mode: "json" }),
    keywords: text("keywords", { mode: "json" }),
    price: real("price"),
    maxPrice: real("max_price"),
    groupDiscount: text("group_discount", { mode: "json" }),
    showGroupDiscount: integer("show_group_discount", { mode: "boolean" }).notNull().default(true),
    duration: text("duration"),
    groupSize: integer("group_size"),
    guestCapacity: integer("guest_capacity"),
    maximumAltitude: integer("maximum_altitude"),
    altitudeChart: text("altitude_chart", { mode: "json" }),
    transportation: text("transportation"),
    meals: text("meals"),
    bestSeason: text("best_season"),
    meetingPoint: text("meeting_point"),
    dropOffPoint: text("drop_off_point"),
    videoUrl: text("video_url"),
    routeMap: text("route_map"),
    mapDescription: text("map_description"),
    images: text("images", { mode: "json" }),
    accommodations: text("accommodations", { mode: "json" }),
    languages: text("languages", { mode: "json" }),
    difficultyLevel: text("difficulty_level", {
      enum: ["EASY", "MODERATE", "HARD", "EXTREME"],
    }),
    isFeatured: integer("is_featured", { mode: "boolean" }).notNull().default(false),
    popularityScore: integer("popularity_score").notNull().default(0),
    views: integer("views").notNull().default(0),
    bookingsCount: integer("bookings_count").notNull().default(0),
    averageRating: real("average_rating").notNull().default(0),
    status: text("status", { enum: ["DRAFT", "PUBLISHED"] })
      .notNull()
      .default("DRAFT"),
    canonicalUrl: text("canonical_url"),
    urlHistory: text("url_history", { mode: "json" }),
    meta: text("meta", { mode: "json" }),
    translations: text("translations", { mode: "json" }),
    countryId: integer("country_id").references(() => locations.id, { onDelete: "set null" }),
    regionId: integer("region_id").references(() => locations.id, { onDelete: "set null" }),
    cityId: integer("city_id").references(() => locations.id, { onDelete: "set null" }),
    tripCategoryId: integer("trip_category_id").references(() => tripCategories.id, {
      onDelete: "set null",
    }),
    tripSeoId: integer("trip_seo_id").references(() => tripSeo.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("activities_slug_uidx").on(t.tenantId, t.slug),
    index("activities_tenant_status_idx").on(t.tenantId, t.status),
    index("activities_tenant_popularity_idx").on(t.tenantId, t.popularityScore),
    index("activities_tenant_featured_idx").on(t.tenantId, t.isFeatured),
  ],
);

export const activityToFeaturedTag = sqliteTable(
  "activity_to_featured_tag",
  {
    activityId: integer("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    featuredTagId: integer("featured_tag_id")
      .notNull()
      .references(() => featuredTags.id, { onDelete: "cascade" }),
  },
  (t) => [
    uniqueIndex("activity_tag_uidx").on(t.activityId, t.featuredTagId),
    index("activity_tag_tag_idx").on(t.featuredTagId),
  ],
);

export const extras = sqliteTable(
  "extras",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    type: text("type", { enum: ["ADDON", "ACCOMMODATION", "MEAL", "OTHER"] })
      .notNull()
      .default("ADDON"),
    name: text("name").notNull(),
    description: text("description"),
    price: real("price"),
    images: text("images", { mode: "json" }),
    translations: text("translations", { mode: "json" }),
    ...timestamps,
  },
  (t) => [index("extras_tenant_idx").on(t.tenantId)],
);

export const activityExtras = sqliteTable(
  "activity_extras",
  {
    activityId: integer("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    extraId: integer("extra_id")
      .notNull()
      .references(() => extras.id, { onDelete: "cascade" }),
  },
  (t) => [
    uniqueIndex("activity_extra_uidx").on(t.activityId, t.extraId),
    index("activity_extra_extra_idx").on(t.extraId),
  ],
);

// ─── Departures & commerce ───────────────────────────────────────────────────

export const departures = sqliteTable(  "departures",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    activityId: integer("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    startDate: text("start_date").notNull(),
    endDate: text("end_date"),
    capacity: integer("capacity").notNull().default(0),
    availableSpots: integer("available_spots").notNull().default(0),
    price: real("price").notNull(),
    status: text("status", { enum: ["OPEN", "FULL", "DELAYED"] })
      .notNull()
      .default("OPEN"),
    ...timestamps,
  },
  (t) => [
    index("departures_tenant_activity_idx").on(t.tenantId, t.activityId),
    index("departures_activity_date_idx").on(t.activityId, t.startDate),
  ],
);

export const bookings = sqliteTable(
  "bookings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    activityId: integer("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    departureId: integer("departure_id")
      .notNull()
      .references(() => departures.id, { onDelete: "cascade" }),
    groupSize: integer("group_size").notNull().default(1),
    totalPrice: real("total_price").notNull(),
    status: text("status", { enum: ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"] })
      .notNull()
      .default("PENDING"),
    name: text("name"),
    email: text("email"),
    phone: text("phone"),
    extraIds: text("extra_ids", { mode: "json" }),
    ...timestamps,
  },
  (t) => [
    index("bookings_tenant_status_idx").on(t.tenantId, t.status),
    index("bookings_tenant_activity_idx").on(t.tenantId, t.activityId),
  ],
);

export const platformSubscriptions = sqliteTable(
  "platform_subscriptions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" })
      .unique(),
    dodoSubscriptionId: text("dodo_subscription_id").unique(),
    dodoCustomerId: text("dodo_customer_id"),
    productId: text("product_id"),
    plan: text("plan", { enum: ["STARTER", "GROWTH", "SCALE", "ENTERPRISE"] }).notNull(),
    interval: text("interval", { enum: ["monthly", "annual"] }),
    status: text("status", {
      enum: ["ACTIVE", "PAST_DUE", "CANCELED", "EXPIRED", "TRIALING"],
    })
      .notNull()
      .default("TRIALING"),
    currentPeriodStart: integer("current_period_start", { mode: "timestamp_ms" }),
    currentPeriodEnd: integer("current_period_end", { mode: "timestamp_ms" }),
    cancelAtPeriodEnd: integer("cancel_at_period_end", { mode: "boolean" }).notNull().default(false),
    ...timestamps,
  },
  (t) => [index("platform_subscriptions_tenant_idx").on(t.tenantId)],
);

/** Dodo webhook ids already applied, so retried deliveries are ignored. */
export const billingEvents = sqliteTable("billing_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  tenantId: integer("tenant_id"),
  receivedAt: integer("received_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const inquiries = sqliteTable(
  "inquiries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    trip: text("trip"),
    message: text("message"),
    status: text("status", { enum: ["NEW", "IN_PROGRESS", "RESOLVED", "CLOSED"] })
      .notNull()
      .default("NEW"),
    ...timestamps,
  },
  (t) => [index("inquiries_tenant_status_idx").on(t.tenantId, t.status)],
);

// ─── Engagement ──────────────────────────────────────────────────────────────

export const reviews = sqliteTable(
  "reviews",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    reviewerId: integer("reviewer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    activityId: integer("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    text: text("text"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("reviews_user_activity_uidx").on(t.reviewerId, t.activityId),
    index("reviews_activity_idx").on(t.activityId),
    index("reviews_tenant_idx").on(t.tenantId),
  ],
);

export const wishlists = sqliteTable(
  "wishlists",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    itemId: integer("item_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [uniqueIndex("wishlists_user_item_uidx").on(t.userId, t.itemId)],
);

export const testimonials = sqliteTable(
  "testimonials",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    rating: integer("rating"),
    content: text("content"),
    author: text("author"),
    media: text("media"),
    translations: text("translations", { mode: "json" }),
    ...timestamps,
  },
  (t) => [index("testimonials_tenant_idx").on(t.tenantId)],
);

export const newsletterSubscribers = sqliteTable(
  "newsletter_subscribers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    unsubSecret: text("unsub_secret").notNull().unique(),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    unsubscribedAt: integer("unsubscribed_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("newsletter_email_uidx").on(t.tenantId, t.email),
    index("newsletter_tenant_idx").on(t.tenantId),
  ],
);

// ─── Content ─────────────────────────────────────────────────────────────────

export const infoPageCategories = sqliteTable(
  "info_page_categories",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    handle: text("handle").notNull(),
    name: text("name"),
    translations: text("translations", { mode: "json" }),
    ...timestamps,
  },
  (t) => [uniqueIndex("info_page_categories_handle_uidx").on(t.tenantId, t.handle)],
);

export const infoPages = sqliteTable(
  "info_pages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    title: text("title"),
    slug: text("slug"),
    content: text("content"),
    coverImage: text("cover_image"),
    metaTitle: text("meta_title"),
    metaDescription: text("meta_description"),
    published: integer("published", { mode: "boolean" }).notNull().default(false),
    featuredInNavbar: integer("featured_in_navbar", { mode: "boolean" }).notNull().default(false),
    infoPageCategoryId: integer("info_page_category_id").references(() => infoPageCategories.id, {
      onDelete: "set null",
    }),
    translations: text("translations", { mode: "json" }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("info_pages_slug_uidx").on(t.tenantId, t.slug),
    index("info_pages_tenant_idx").on(t.tenantId),
  ],
);

export const blogs = sqliteTable(
  "blogs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    title: text("title"),
    slug: text("slug").notNull(),
    content: text("content"),
    coverImage: text("cover_image"),
    tags: text("tags", { mode: "json" }),
    published: integer("published", { mode: "boolean" }).notNull().default(false),
    inTrash: integer("in_trash", { mode: "boolean" }).notNull().default(false),
    views: integer("views").notNull().default(0),
    likes: integer("likes").notNull().default(0),
    publishedAt: integer("published_at", { mode: "timestamp_ms" }),
    metaTitle: text("meta_title"),
    metaDescription: text("meta_description"),
    canonicalUrl: text("canonical_url"),
    urlHistory: text("url_history", { mode: "json" }),
    postType: text("post_type", { enum: ["BLOG", "TRAVEL_GUIDE"] })
      .notNull()
      .default("BLOG"),
    cityId: integer("city_id").references(() => locations.id, { onDelete: "set null" }),
    authorId: integer("author_id").references(() => tenantStaff.id, { onDelete: "set null" }),
    writerId: integer("writer_id").references(() => authors.id, { onDelete: "set null" }),
    blogCategoryId: integer("blog_category_id").references(() => infoPageCategories.id, {
      onDelete: "set null",
    }),
    translations: text("translations", { mode: "json" }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("blogs_slug_uidx").on(t.tenantId, t.slug),
    index("blogs_tenant_published_idx").on(t.tenantId, t.published),
    index("blogs_tenant_trash_idx").on(t.tenantId, t.inTrash),
  ],
);

export const media = sqliteTable(
  "media",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    filename: text("filename").notNull(),
    alt: text("alt"),
    caption: text("caption"),
    title: text("title"),
    description: text("description"),
    mimeType: text("mime_type"),
    fileSize: integer("file_size"),
    width: integer("width"),
    height: integer("height"),
    ...timestamps,
  },
  (t) => [index("media_tenant_idx").on(t.tenantId)],
);

export const redirects = sqliteTable(
  "redirects",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    from: text("from").notNull(),
    to: text("to").notNull(),
    permanent: integer("permanent", { mode: "boolean" }).notNull().default(true),
    ...timestamps,
  },
  (t) => [uniqueIndex("redirects_from_uidx").on(t.tenantId, t.from)],
);

export const teamDepartments = sqliteTable(
  "team_departments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name"),
    description: text("description"),
    translations: text("translations", { mode: "json" }),
    ...timestamps,
  },
  (t) => [index("team_departments_tenant_idx").on(t.tenantId)],
);

export const teamMembers = sqliteTable(
  "team_members",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    departmentId: integer("department_id").references(() => teamDepartments.id, {
      onDelete: "set null",
    }),
    image: text("image"),
    name: text("name"),
    designation: text("designation"),
    about: text("about"),
    translations: text("translations", { mode: "json" }),
    ...timestamps,
  },
  (t) => [index("team_members_tenant_idx").on(t.tenantId)],
);

export const documents = sqliteTable(
  "documents",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    path: text("path").notNull(),
    published: integer("published", { mode: "boolean" }).notNull().default(false),
    ...timestamps,
  },
  (t) => [index("documents_tenant_idx").on(t.tenantId)],
);

// ─── Support ─────────────────────────────────────────────────────────────────

export const supportTickets = sqliteTable(
  "support_tickets",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    creatorId: integer("creator_id").references(() => tenantStaff.id, { onDelete: "set null" }),
    creatorName: text("creator_name"),
    category: text("category").notNull(),
    subject: text("subject").notNull(),
    message: text("message").notNull(),
    callbackNumber: text("callback_number"),
    priority: text("priority", { enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] })
      .notNull()
      .default("MEDIUM"),
    status: text("status", { enum: ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] })
      .notNull()
      .default("OPEN"),
    ...timestamps,
  },
  (t) => [index("support_tickets_tenant_idx").on(t.tenantId)],
);

export const supportTicketReplies = sqliteTable(
  "support_ticket_replies",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ticketId: integer("ticket_id")
      .notNull()
      .references(() => supportTickets.id, { onDelete: "cascade" }),
    staffId: integer("staff_id").references(() => tenantStaff.id, { onDelete: "set null" }),
    authorName: text("author_name"),
    message: text("message").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("support_ticket_replies_ticket_idx").on(t.ticketId)],
);

// ─── Inferred row types ──────────────────────────────────────────────────────

export type Tenant = typeof tenants.$inferSelect;
export type TenantStaff = typeof tenantStaff.$inferSelect;
export type User = typeof users.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type Departure = typeof departures.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type PlatformSubscription = typeof platformSubscriptions.$inferSelect;
export type Inquiry = typeof inquiries.$inferSelect;
export type Blog = typeof blogs.$inferSelect;
export type InfoPage = typeof infoPages.$inferSelect;
export type Media = typeof media.$inferSelect;
export type NewsletterSubscriber = typeof newsletterSubscribers.$inferSelect;
export type SupportTicket = typeof supportTickets.$inferSelect;
export type PlatformAdmin = typeof platformAdmins.$inferSelect;

// ─── Relations ───────────────────────────────────────────────────────────────

import { relations } from "drizzle-orm";

export const tenantsRelations = relations(tenants, ({ many }) => ({
  staff: many(tenantStaff),
  activities: many(activities),
}));

export const tenantStaffRelations = relations(tenantStaff, ({ one }) => ({
  tenant: one(tenants, { fields: [tenantStaff.tenantId], references: [tenants.id] }),
}));

export const activityRelations = relations(activities, ({ one, many }) => ({
  tenant: one(tenants, { fields: [activities.tenantId], references: [tenants.id] }),
  country: one(locations, {
    fields: [activities.countryId],
    references: [locations.id],
    relationName: "activityCountry",
  }),
  region: one(locations, {
    fields: [activities.regionId],
    references: [locations.id],
    relationName: "activityRegion",
  }),
  city: one(locations, {
    fields: [activities.cityId],
    references: [locations.id],
    relationName: "activityCity",
  }),
  tripCategory: one(tripCategories, {
    fields: [activities.tripCategoryId],
    references: [tripCategories.id],
  }),
  tripSeo: one(tripSeo, { fields: [activities.tripSeoId], references: [tripSeo.id] }),
  departures: many(departures),
  bookings: many(bookings),
  featuredTags: many(activityToFeaturedTag),
  extras: many(activityExtras),
}));

export const activityToFeaturedTagRelations = relations(activityToFeaturedTag, ({ one }) => ({
  activity: one(activities, {
    fields: [activityToFeaturedTag.activityId],
    references: [activities.id],
  }),
  featuredTag: one(featuredTags, {
    fields: [activityToFeaturedTag.featuredTagId],
    references: [featuredTags.id],
  }),
}));

export const activityExtrasRelations = relations(activityExtras, ({ one }) => ({
  activity: one(activities, { fields: [activityExtras.activityId], references: [activities.id] }),
  extra: one(extras, { fields: [activityExtras.extraId], references: [extras.id] }),
}));

export const departureRelations = relations(departures, ({ one }) => ({
  activity: one(activities, { fields: [departures.activityId], references: [activities.id] }),
  tenant: one(tenants, { fields: [departures.tenantId], references: [tenants.id] }),
}));

export const bookingRelations = relations(bookings, ({ one }) => ({
  activity: one(activities, { fields: [bookings.activityId], references: [activities.id] }),
  departure: one(departures, { fields: [bookings.departureId], references: [departures.id] }),
  tenant: one(tenants, { fields: [bookings.tenantId], references: [tenants.id] }),
}));

export const blogRelations = relations(blogs, ({ one }) => ({
  city: one(locations, { fields: [blogs.cityId], references: [locations.id], relationName: "blogCity" }),
  author: one(tenantStaff, { fields: [blogs.authorId], references: [tenantStaff.id] }),
  writer: one(authors, { fields: [blogs.writerId], references: [authors.id] }),
  blogCategory: one(infoPageCategories, {
    fields: [blogs.blogCategoryId],
    references: [infoPageCategories.id],
  }),
}));

export const infoPageRelations = relations(infoPages, ({ one }) => ({
  category: one(infoPageCategories, {
    fields: [infoPages.infoPageCategoryId],
    references: [infoPageCategories.id],
  }),
}));

export const teamMemberRelations = relations(teamMembers, ({ one }) => ({
  department: one(teamDepartments, {
    fields: [teamMembers.departmentId],
    references: [teamDepartments.id],
  }),
}));

export const supportTicketRelations = relations(supportTickets, ({ one, many }) => ({
  creator: one(tenantStaff, { fields: [supportTickets.creatorId], references: [tenantStaff.id] }),
  replies: many(supportTicketReplies),
}));

export const supportTicketReplyRelations = relations(supportTicketReplies, ({ one }) => ({
  ticket: one(supportTickets, { fields: [supportTicketReplies.ticketId], references: [supportTickets.id] }),
  staff: one(tenantStaff, { fields: [supportTicketReplies.staffId], references: [tenantStaff.id] }),
}));

export const platformSubscriptionRelations = relations(platformSubscriptions, ({ one }) => ({
  tenant: one(tenants, { fields: [platformSubscriptions.tenantId], references: [tenants.id] }),
}));

export const reviewRelations = relations(reviews, ({ one }) => ({
  activity: one(activities, { fields: [reviews.activityId], references: [activities.id] }),
  reviewer: one(users, { fields: [reviews.reviewerId], references: [users.id] }),
}));

export const wishlistRelations = relations(wishlists, ({ one }) => ({
  activity: one(activities, { fields: [wishlists.itemId], references: [activities.id] }),
}));

export const platformAuditLogRelations = relations(platformAuditLog, ({ one }) => ({
  admin: one(platformAdmins, { fields: [platformAuditLog.adminId], references: [platformAdmins.id] }),
}));
