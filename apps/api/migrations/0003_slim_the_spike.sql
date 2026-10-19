CREATE TABLE `locations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`type` text NOT NULL,
	`handle` text NOT NULL,
	`name` text,
	`image` text,
	`show_on_homepage` integer DEFAULT false NOT NULL,
	`translations` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `locations_type_handle_uidx` ON `locations` (`tenant_id`,`type`,`handle`);--> statement-breakpoint
INSERT INTO `locations` ("tenant_id", "type", "handle", "name", "image", "show_on_homepage", "translations", "created_at", "updated_at") SELECT "tenant_id", 'COUNTRY', "handle", "name", "image", "show_on_homepage", "translations", "created_at", "updated_at" FROM `countries`;--> statement-breakpoint
INSERT INTO `locations` ("tenant_id", "type", "handle", "name", "image", "show_on_homepage", "translations", "created_at", "updated_at") SELECT "tenant_id", 'REGION', "handle", "name", "image", "show_on_homepage", "translations", "created_at", "updated_at" FROM `regions`;--> statement-breakpoint
INSERT INTO `locations` ("tenant_id", "type", "handle", "name", "image", "show_on_homepage", "translations", "created_at", "updated_at") SELECT "tenant_id", 'CITY', "handle", "name", "image", "show_on_homepage", "translations", "created_at", "updated_at" FROM `cities`;--> statement-breakpoint
PRAGMA defer_foreign_keys=ON;--> statement-breakpoint
UPDATE `activities` SET
	"country_id" = (SELECT l."id" FROM `countries` c JOIN `locations` l ON l."tenant_id" = c."tenant_id" AND l."type" = 'COUNTRY' AND l."handle" = c."handle" WHERE c."id" = "activities"."country_id"),
	"region_id" = (SELECT l."id" FROM `regions` r JOIN `locations` l ON l."tenant_id" = r."tenant_id" AND l."type" = 'REGION' AND l."handle" = r."handle" WHERE r."id" = "activities"."region_id"),
	"city_id" = (SELECT l."id" FROM `cities` ct JOIN `locations` l ON l."tenant_id" = ct."tenant_id" AND l."type" = 'CITY' AND l."handle" = ct."handle" WHERE ct."id" = "activities"."city_id")
WHERE "country_id" IS NOT NULL OR "region_id" IS NOT NULL OR "city_id" IS NOT NULL;--> statement-breakpoint
UPDATE `blogs` SET "city_id" = (SELECT l."id" FROM `cities` c JOIN `locations` l ON l."tenant_id" = c."tenant_id" AND l."type" = 'CITY' AND l."handle" = c."handle" WHERE c."id" = "blogs"."city_id") WHERE "city_id" IS NOT NULL;--> statement-breakpoint
CREATE TABLE `_bk_activity_to_featured_tag` AS SELECT * FROM `activity_to_featured_tag`;--> statement-breakpoint
CREATE TABLE `_bk_activity_extras` AS SELECT * FROM `activity_extras`;--> statement-breakpoint
CREATE TABLE `_bk_departures` AS SELECT * FROM `departures`;--> statement-breakpoint
CREATE TABLE `_bk_bookings` AS SELECT * FROM `bookings`;--> statement-breakpoint
CREATE TABLE `_bk_reviews` AS SELECT * FROM `reviews`;--> statement-breakpoint
CREATE TABLE `_bk_wishlists` AS SELECT * FROM `wishlists`;--> statement-breakpoint
CREATE TABLE `_bk_generated_itineraries` AS SELECT * FROM `generated_itineraries`;--> statement-breakpoint
CREATE TABLE `__new_activities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`title` text,
	`slug` text NOT NULL,
	`overview` text,
	`highlights` text,
	`inclusions` text,
	`exclusions` text,
	`itinerary` text,
	`additional_info` text,
	`faq` text,
	`what_to_bring` text,
	`keywords` text,
	`price` real,
	`max_price` real,
	`group_discount` text,
	`show_group_discount` integer DEFAULT true NOT NULL,
	`duration` text,
	`group_size` integer,
	`guest_capacity` integer,
	`maximum_altitude` integer,
	`altitude_chart` text,
	`transportation` text,
	`meals` text,
	`best_season` text,
	`meeting_point` text,
	`drop_off_point` text,
	`video_url` text,
	`route_map` text,
	`map_description` text,
	`images` text,
	`accommodations` text,
	`languages` text,
	`difficulty_level` text,
	`is_featured` integer DEFAULT false NOT NULL,
	`popularity_score` integer DEFAULT 0 NOT NULL,
	`views` integer DEFAULT 0 NOT NULL,
	`bookings_count` integer DEFAULT 0 NOT NULL,
	`average_rating` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`canonical_url` text,
	`url_history` text,
	`meta` text,
	`translations` text,
	`country_id` integer,
	`region_id` integer,
	`city_id` integer,
	`trip_category_id` integer,
	`trip_seo_id` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`country_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`region_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`city_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`trip_category_id`) REFERENCES `trip_categories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`trip_seo_id`) REFERENCES `trip_seo`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_activities`("id", "tenant_id", "title", "slug", "overview", "highlights", "inclusions", "exclusions", "itinerary", "additional_info", "faq", "what_to_bring", "keywords", "price", "max_price", "group_discount", "show_group_discount", "duration", "group_size", "guest_capacity", "maximum_altitude", "altitude_chart", "transportation", "meals", "best_season", "meeting_point", "drop_off_point", "video_url", "route_map", "map_description", "images", "accommodations", "languages", "difficulty_level", "is_featured", "popularity_score", "views", "bookings_count", "average_rating", "status", "canonical_url", "url_history", "meta", "translations", "country_id", "region_id", "city_id", "trip_category_id", "trip_seo_id", "created_at", "updated_at") SELECT "id", "tenant_id", "title", "slug", "overview", "highlights", "inclusions", "exclusions", "itinerary", "additional_info", "faq", "what_to_bring", "keywords", "price", "max_price", "group_discount", "show_group_discount", "duration", "group_size", "guest_capacity", "maximum_altitude", "altitude_chart", "transportation", "meals", "best_season", "meeting_point", "drop_off_point", "video_url", "route_map", "map_description", "images", "accommodations", "languages", "difficulty_level", "is_featured", "popularity_score", "views", "bookings_count", "average_rating", "status", "canonical_url", "url_history", "meta", "translations", "country_id", "region_id", "city_id", "trip_category_id", "trip_seo_id", "created_at", "updated_at" FROM `activities`;--> statement-breakpoint
DROP TABLE `activities`;--> statement-breakpoint
ALTER TABLE `__new_activities` RENAME TO `activities`;--> statement-breakpoint
CREATE UNIQUE INDEX `activities_slug_uidx` ON `activities` (`tenant_id`,`slug`);--> statement-breakpoint
CREATE INDEX `activities_tenant_status_idx` ON `activities` (`tenant_id`,`status`);--> statement-breakpoint
CREATE INDEX `activities_tenant_popularity_idx` ON `activities` (`tenant_id`,`popularity_score`);--> statement-breakpoint
CREATE INDEX `activities_tenant_featured_idx` ON `activities` (`tenant_id`,`is_featured`);--> statement-breakpoint
CREATE TABLE `__new_blogs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`title` text,
	`slug` text NOT NULL,
	`content` text,
	`cover_image` text,
	`tags` text,
	`published` integer DEFAULT false NOT NULL,
	`in_trash` integer DEFAULT false NOT NULL,
	`views` integer DEFAULT 0 NOT NULL,
	`likes` integer DEFAULT 0 NOT NULL,
	`published_at` integer,
	`meta_title` text,
	`meta_description` text,
	`canonical_url` text,
	`url_history` text,
	`post_type` text DEFAULT 'BLOG' NOT NULL,
	`city_id` integer,
	`author_id` integer,
	`writer_id` integer,
	`blog_category_id` integer,
	`translations` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`city_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`author_id`) REFERENCES `tenant_staff`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`writer_id`) REFERENCES `authors`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`blog_category_id`) REFERENCES `info_page_categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_blogs`("id", "tenant_id", "title", "slug", "content", "cover_image", "tags", "published", "in_trash", "views", "likes", "published_at", "meta_title", "meta_description", "canonical_url", "url_history", "post_type", "city_id", "author_id", "writer_id", "blog_category_id", "translations", "created_at", "updated_at") SELECT "id", "tenant_id", "title", "slug", "content", "cover_image", "tags", "published", "in_trash", "views", "likes", "published_at", "meta_title", "meta_description", "canonical_url", "url_history", "post_type", "city_id", "author_id", "writer_id", "blog_category_id", "translations", "created_at", "updated_at" FROM `blogs`;--> statement-breakpoint
DROP TABLE `blogs`;--> statement-breakpoint
ALTER TABLE `__new_blogs` RENAME TO `blogs`;--> statement-breakpoint
CREATE UNIQUE INDEX `blogs_slug_uidx` ON `blogs` (`tenant_id`,`slug`);--> statement-breakpoint
CREATE INDEX `blogs_tenant_published_idx` ON `blogs` (`tenant_id`,`published`);--> statement-breakpoint
CREATE INDEX `blogs_tenant_trash_idx` ON `blogs` (`tenant_id`,`in_trash`);--> statement-breakpoint
INSERT INTO `activity_to_featured_tag` SELECT * FROM `_bk_activity_to_featured_tag`;--> statement-breakpoint
INSERT INTO `activity_extras` SELECT * FROM `_bk_activity_extras`;--> statement-breakpoint
INSERT INTO `departures` SELECT * FROM `_bk_departures`;--> statement-breakpoint
INSERT INTO `bookings` SELECT * FROM `_bk_bookings`;--> statement-breakpoint
INSERT INTO `reviews` SELECT * FROM `_bk_reviews`;--> statement-breakpoint
INSERT INTO `wishlists` SELECT * FROM `_bk_wishlists`;--> statement-breakpoint
INSERT OR REPLACE INTO `generated_itineraries` SELECT * FROM `_bk_generated_itineraries`;--> statement-breakpoint
DROP TABLE `_bk_activity_to_featured_tag`;--> statement-breakpoint
DROP TABLE `_bk_activity_extras`;--> statement-breakpoint
DROP TABLE `_bk_departures`;--> statement-breakpoint
DROP TABLE `_bk_bookings`;--> statement-breakpoint
DROP TABLE `_bk_reviews`;--> statement-breakpoint
DROP TABLE `_bk_wishlists`;--> statement-breakpoint
DROP TABLE `_bk_generated_itineraries`;--> statement-breakpoint
DROP TABLE `countries`;--> statement-breakpoint
DROP TABLE `regions`;--> statement-breakpoint
DROP TABLE `cities`;--> statement-breakpoint
PRAGMA defer_foreign_keys=OFF;
