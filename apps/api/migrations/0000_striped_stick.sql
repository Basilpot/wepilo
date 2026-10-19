CREATE TABLE `activities` (
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
	`duration` text,
	`group_size` integer,
	`guest_capacity` integer,
	`maximum_altitude` integer,
	`transportation` text,
	`meals` text,
	`best_season` text,
	`meeting_point` text,
	`drop_off_point` text,
	`video_url` text,
	`route_map` text,
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
	FOREIGN KEY (`country_id`) REFERENCES `countries`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`region_id`) REFERENCES `regions`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`trip_category_id`) REFERENCES `trip_categories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`trip_seo_id`) REFERENCES `trip_seo`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `activities_slug_uidx` ON `activities` (`tenant_id`,`slug`);--> statement-breakpoint
CREATE INDEX `activities_tenant_status_idx` ON `activities` (`tenant_id`,`status`);--> statement-breakpoint
CREATE INDEX `activities_tenant_popularity_idx` ON `activities` (`tenant_id`,`popularity_score`);--> statement-breakpoint
CREATE INDEX `activities_tenant_featured_idx` ON `activities` (`tenant_id`,`is_featured`);--> statement-breakpoint
CREATE TABLE `activity_extras` (
	`activity_id` integer NOT NULL,
	`extra_id` integer NOT NULL,
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`extra_id`) REFERENCES `extras`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `activity_extra_uidx` ON `activity_extras` (`activity_id`,`extra_id`);--> statement-breakpoint
CREATE INDEX `activity_extra_extra_idx` ON `activity_extras` (`extra_id`);--> statement-breakpoint
CREATE TABLE `activity_to_featured_tag` (
	`activity_id` integer NOT NULL,
	`featured_tag_id` integer NOT NULL,
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`featured_tag_id`) REFERENCES `featured_tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `activity_tag_uidx` ON `activity_to_featured_tag` (`activity_id`,`featured_tag_id`);--> statement-breakpoint
CREATE INDEX `activity_tag_tag_idx` ON `activity_to_featured_tag` (`featured_tag_id`);--> statement-breakpoint
CREATE TABLE `authors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`username` text NOT NULL,
	`name` text,
	`email` text NOT NULL,
	`password` text NOT NULL,
	`bio` text,
	`image` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `authors_username_uidx` ON `authors` (`tenant_id`,`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `authors_email_uidx` ON `authors` (`tenant_id`,`email`);--> statement-breakpoint
CREATE INDEX `authors_tenant_idx` ON `authors` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `blogs` (
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
	FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`author_id`) REFERENCES `tenant_staff`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`writer_id`) REFERENCES `authors`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`blog_category_id`) REFERENCES `info_page_categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `blogs_slug_uidx` ON `blogs` (`tenant_id`,`slug`);--> statement-breakpoint
CREATE INDEX `blogs_tenant_published_idx` ON `blogs` (`tenant_id`,`published`);--> statement-breakpoint
CREATE INDEX `blogs_tenant_trash_idx` ON `blogs` (`tenant_id`,`in_trash`);--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`activity_id` integer NOT NULL,
	`departure_id` integer NOT NULL,
	`group_size` integer DEFAULT 1 NOT NULL,
	`total_price` real NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`name` text,
	`email` text,
	`phone` text,
	`extra_ids` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`departure_id`) REFERENCES `departures`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `bookings_tenant_status_idx` ON `bookings` (`tenant_id`,`status`);--> statement-breakpoint
CREATE INDEX `bookings_tenant_activity_idx` ON `bookings` (`tenant_id`,`activity_id`);--> statement-breakpoint
CREATE TABLE `cities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
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
CREATE UNIQUE INDEX `cities_handle_uidx` ON `cities` (`tenant_id`,`handle`);--> statement-breakpoint
CREATE TABLE `countries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
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
CREATE UNIQUE INDEX `countries_handle_uidx` ON `countries` (`tenant_id`,`handle`);--> statement-breakpoint
CREATE TABLE `departures` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`activity_id` integer NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`capacity` integer DEFAULT 0 NOT NULL,
	`available_spots` integer DEFAULT 0 NOT NULL,
	`price` real NOT NULL,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `departures_tenant_activity_idx` ON `departures` (`tenant_id`,`activity_id`);--> statement-breakpoint
CREATE INDEX `departures_activity_date_idx` ON `departures` (`activity_id`,`start_date`);--> statement-breakpoint
CREATE TABLE `documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`title` text NOT NULL,
	`path` text NOT NULL,
	`published` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `documents_tenant_idx` ON `documents` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `extras` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`type` text DEFAULT 'ADDON' NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`price` real,
	`images` text,
	`translations` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `extras_tenant_idx` ON `extras` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `featured_tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`show_on_homepage` integer DEFAULT false NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	`translations` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `featured_tags_slug_uidx` ON `featured_tags` (`tenant_id`,`slug`);--> statement-breakpoint
CREATE TABLE `generated_itineraries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`batch_id` integer NOT NULL,
	`topic` text NOT NULL,
	`title` text,
	`slug` text,
	`data` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`error` text,
	`activity_id` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`batch_id`) REFERENCES `generation_batches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `generated_itineraries_batch_idx` ON `generated_itineraries` (`batch_id`);--> statement-breakpoint
CREATE TABLE `generation_batches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`batch_id` text,
	`provider` text DEFAULT 'CLAUDE' NOT NULL,
	`topics` text NOT NULL,
	`focus` text,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`error` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `generation_batches_tenant_idx` ON `generation_batches` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `info_page_categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`handle` text NOT NULL,
	`name` text,
	`translations` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `info_page_categories_handle_uidx` ON `info_page_categories` (`tenant_id`,`handle`);--> statement-breakpoint
CREATE TABLE `info_pages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`title` text,
	`slug` text,
	`content` text,
	`cover_image` text,
	`meta_title` text,
	`meta_description` text,
	`published` integer DEFAULT false NOT NULL,
	`featured_in_navbar` integer DEFAULT false NOT NULL,
	`info_page_category_id` integer,
	`translations` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`info_page_category_id`) REFERENCES `info_page_categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `info_pages_slug_uidx` ON `info_pages` (`tenant_id`,`slug`);--> statement-breakpoint
CREATE INDEX `info_pages_tenant_idx` ON `info_pages` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `inquiries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text,
	`trip` text,
	`message` text,
	`status` text DEFAULT 'NEW' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `inquiries_tenant_status_idx` ON `inquiries` (`tenant_id`,`status`);--> statement-breakpoint
CREATE TABLE `media` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`url` text NOT NULL,
	`filename` text NOT NULL,
	`alt` text,
	`caption` text,
	`title` text,
	`description` text,
	`mime_type` text,
	`file_size` integer,
	`width` integer,
	`height` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `media_tenant_idx` ON `media` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `newsletter_subscribers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`email` text NOT NULL,
	`unsub_secret` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`unsubscribed_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `newsletter_subscribers_unsub_secret_unique` ON `newsletter_subscribers` (`unsub_secret`);--> statement-breakpoint
CREATE UNIQUE INDEX `newsletter_email_uidx` ON `newsletter_subscribers` (`tenant_id`,`email`);--> statement-breakpoint
CREATE INDEX `newsletter_tenant_idx` ON `newsletter_subscribers` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `platform_subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`dodo_subscription_id` text,
	`dodo_customer_id` text,
	`product_id` text,
	`plan` text NOT NULL,
	`status` text DEFAULT 'TRIALING' NOT NULL,
	`current_period_start` integer,
	`current_period_end` integer,
	`cancel_at_period_end` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `platform_subscriptions_tenant_id_unique` ON `platform_subscriptions` (`tenant_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `platform_subscriptions_dodo_subscription_id_unique` ON `platform_subscriptions` (`dodo_subscription_id`);--> statement-breakpoint
CREATE INDEX `platform_subscriptions_tenant_idx` ON `platform_subscriptions` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `redirects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`from` text NOT NULL,
	`to` text NOT NULL,
	`permanent` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `redirects_from_uidx` ON `redirects` (`tenant_id`,`from`);--> statement-breakpoint
CREATE TABLE `regions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
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
CREATE UNIQUE INDEX `regions_handle_uidx` ON `regions` (`tenant_id`,`handle`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`reviewer_id` integer NOT NULL,
	`activity_id` integer NOT NULL,
	`rating` integer NOT NULL,
	`text` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reviewer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_user_activity_uidx` ON `reviews` (`reviewer_id`,`activity_id`);--> statement-breakpoint
CREATE INDEX `reviews_activity_idx` ON `reviews` (`activity_id`);--> statement-breakpoint
CREATE INDEX `reviews_tenant_idx` ON `reviews` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `support_ticket_replies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ticket_id` integer NOT NULL,
	`staff_id` integer,
	`author_name` text,
	`message` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`ticket_id`) REFERENCES `support_tickets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`staff_id`) REFERENCES `tenant_staff`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `support_ticket_replies_ticket_idx` ON `support_ticket_replies` (`ticket_id`);--> statement-breakpoint
CREATE TABLE `support_tickets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`creator_id` integer,
	`creator_name` text,
	`category` text NOT NULL,
	`subject` text NOT NULL,
	`message` text NOT NULL,
	`callback_number` text,
	`priority` text DEFAULT 'MEDIUM' NOT NULL,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`creator_id`) REFERENCES `tenant_staff`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `support_tickets_tenant_idx` ON `support_tickets` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `team_departments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`name` text,
	`description` text,
	`translations` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `team_departments_tenant_idx` ON `team_departments` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `team_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`department_id` integer,
	`image` text,
	`name` text,
	`designation` text,
	`about` text,
	`translations` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`department_id`) REFERENCES `team_departments`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `team_members_tenant_idx` ON `team_members` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `tenant_staff` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password` text NOT NULL,
	`role` text DEFAULT 'EDITOR' NOT NULL,
	`permissions` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenant_staff_email_uidx` ON `tenant_staff` (`tenant_id`,`email`);--> statement-breakpoint
CREATE INDEX `tenant_staff_tenant_idx` ON `tenant_staff` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`password` text NOT NULL,
	`company_name` text,
	`company_logo` text,
	`website` text,
	`company_description` text,
	`phone` text,
	`address` text,
	`slug` text NOT NULL,
	`custom_domain` text,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`plan` text DEFAULT 'LAUNCH' NOT NULL,
	`plan_expires_at` integer,
	`api_key_hash` text,
	`claude_api_key_enc` text,
	`dodo_customer_id` text,
	`site_config` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenants_email_unique` ON `tenants` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `tenants_slug_unique` ON `tenants` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `tenants_custom_domain_unique` ON `tenants` (`custom_domain`);--> statement-breakpoint
CREATE UNIQUE INDEX `tenants_api_key_hash_unique` ON `tenants` (`api_key_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `tenants_dodo_customer_id_unique` ON `tenants` (`dodo_customer_id`);--> statement-breakpoint
CREATE INDEX `tenants_status_idx` ON `tenants` (`status`);--> statement-breakpoint
CREATE TABLE `testimonials` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`rating` integer,
	`content` text,
	`author` text,
	`media` text,
	`translations` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `testimonials_tenant_idx` ON `testimonials` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `trip_categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
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
CREATE UNIQUE INDEX `trip_categories_handle_uidx` ON `trip_categories` (`tenant_id`,`handle`);--> statement-breakpoint
CREATE TABLE `trip_seo` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`meta_title` text,
	`meta_description` text,
	`meta_keywords` text,
	`meta_robots` text,
	`meta_author` text,
	`canonical_url` text,
	`featured_media` text,
	`schema` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`name` text,
	`email` text NOT NULL,
	`username` text NOT NULL,
	`password` text NOT NULL,
	`phone` text,
	`date_of_birth` text,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`bio` text,
	`meta` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_uidx` ON `users` (`tenant_id`,`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_uidx` ON `users` (`tenant_id`,`username`);--> statement-breakpoint
CREATE INDEX `users_tenant_idx` ON `users` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `wishlists` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`item_id` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wishlists_user_item_uidx` ON `wishlists` (`user_id`,`item_id`);