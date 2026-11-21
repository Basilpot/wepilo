ALTER TABLE `activities` ADD `publish_at` integer;--> statement-breakpoint
ALTER TABLE `blogs` ADD `publish_at` integer;--> statement-breakpoint
ALTER TABLE `info_pages` ADD `publish_at` integer;--> statement-breakpoint
ALTER TABLE `tenants` ADD `default_language` text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE `tenants` ADD `languages` text;