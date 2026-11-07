ALTER TABLE `tenant_staff` ADD `username` text;
--> statement-breakpoint
ALTER TABLE `tenant_staff` ADD `bio` text;
--> statement-breakpoint
ALTER TABLE `tenant_staff` ADD `image` text;
--> statement-breakpoint
-- Authors become staff logins with the Author role. Anyone who already has a login with the same email keeps it and just gains the profile.
INSERT INTO `tenant_staff` (`tenant_id`, `name`, `email`, `password`, `role`, `permissions`, `is_active`, `username`, `bio`, `image`, `created_at`, `updated_at`)
SELECT a.`tenant_id`, COALESCE(a.`name`, a.`username`), a.`email`, a.`password`, 'AUTHOR', '[]', 1, a.`username`, a.`bio`, a.`image`, a.`created_at`, a.`updated_at`
FROM `authors` a
WHERE NOT EXISTS (SELECT 1 FROM `tenant_staff` s WHERE s.`tenant_id` = a.`tenant_id` AND s.`email` = a.`email`);--> statement-breakpoint
UPDATE `tenant_staff`
SET `username` = (SELECT a.`username` FROM `authors` a WHERE a.`tenant_id` = `tenant_staff`.`tenant_id` AND a.`email` = `tenant_staff`.`email`),
    `bio` = COALESCE(`bio`, (SELECT a.`bio` FROM `authors` a WHERE a.`tenant_id` = `tenant_staff`.`tenant_id` AND a.`email` = `tenant_staff`.`email`)),
    `image` = COALESCE(`image`, (SELECT a.`image` FROM `authors` a WHERE a.`tenant_id` = `tenant_staff`.`tenant_id` AND a.`email` = `tenant_staff`.`email`))
WHERE `username` IS NULL AND EXISTS (SELECT 1 FROM `authors` a WHERE a.`tenant_id` = `tenant_staff`.`tenant_id` AND a.`email` = `tenant_staff`.`email`);--> statement-breakpoint
-- Posts keep their byline: the copy below points each post at the matching staff login.
PRAGMA foreign_keys=OFF;
--> statement-breakpoint
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
	FOREIGN KEY (`writer_id`) REFERENCES `tenant_staff`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`blog_category_id`) REFERENCES `info_page_categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_blogs`("id", "tenant_id", "title", "slug", "content", "cover_image", "tags", "published", "in_trash", "views", "likes", "published_at", "meta_title", "meta_description", "canonical_url", "url_history", "post_type", "city_id", "author_id", "writer_id", "blog_category_id", "translations", "created_at", "updated_at") SELECT "id", "tenant_id", "title", "slug", "content", "cover_image", "tags", "published", "in_trash", "views", "likes", "published_at", "meta_title", "meta_description", "canonical_url", "url_history", "post_type", "city_id", "author_id", (SELECT st.`id` FROM `authors` au JOIN `tenant_staff` st ON st.`tenant_id` = au.`tenant_id` AND st.`email` = au.`email` WHERE au.`id` = `blogs`.`writer_id`), "blog_category_id", "translations", "created_at", "updated_at" FROM `blogs`;
--> statement-breakpoint
DROP TABLE `blogs`;
--> statement-breakpoint
ALTER TABLE `__new_blogs` RENAME TO `blogs`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
--> statement-breakpoint
CREATE UNIQUE INDEX `blogs_slug_uidx` ON `blogs` (`tenant_id`,`slug`);
--> statement-breakpoint
CREATE INDEX `blogs_tenant_published_idx` ON `blogs` (`tenant_id`,`published`);
--> statement-breakpoint
CREATE INDEX `blogs_tenant_trash_idx` ON `blogs` (`tenant_id`,`in_trash`);

--> statement-breakpoint
DROP TABLE `authors`;
--> statement-breakpoint
CREATE UNIQUE INDEX `tenant_staff_username_uidx` ON `tenant_staff` (`tenant_id`,`username`);
