CREATE TABLE `review_links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`activity_id` integer NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_by_id` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_id`) REFERENCES `tenant_staff`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `review_links_token_uidx` ON `review_links` (`token`);--> statement-breakpoint
CREATE INDEX `review_links_tenant_idx` ON `review_links` (`tenant_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_reviews` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`reviewer_id` integer,
	`reviewer_name` text,
	`reviewer_email` text,
	`activity_id` integer NOT NULL,
	`rating` integer NOT NULL,
	`title` text,
	`text` text,
	`images` text,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`source` text DEFAULT 'WEBSITE' NOT NULL,
	`published_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reviewer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
-- Reviews that already exist were written by signed-in website users: they stay visible.
INSERT INTO `__new_reviews`("id", "tenant_id", "reviewer_id", "activity_id", "rating", "text", "status", "source", "published_at", "created_at", "updated_at") SELECT "id", "tenant_id", "reviewer_id", "activity_id", "rating", "text", 'PUBLISHED', 'WEBSITE', "created_at", "created_at", "updated_at" FROM `reviews`;--> statement-breakpoint
DROP TABLE `reviews`;--> statement-breakpoint
ALTER TABLE `__new_reviews` RENAME TO `reviews`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_user_activity_uidx` ON `reviews` (`reviewer_id`,`activity_id`);--> statement-breakpoint
CREATE INDEX `reviews_activity_idx` ON `reviews` (`activity_id`);--> statement-breakpoint
CREATE INDEX `reviews_tenant_idx` ON `reviews` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `reviews_tenant_status_idx` ON `reviews` (`tenant_id`,`status`);