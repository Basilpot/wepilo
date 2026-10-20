CREATE TABLE `platform_admins` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`password` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`last_login_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `platform_admins_email_unique` ON `platform_admins` (`email`);--> statement-breakpoint
CREATE TABLE `platform_audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`admin_id` integer,
	`tenant_id` integer,
	`action` text NOT NULL,
	`detail` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`admin_id`) REFERENCES `platform_admins`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `platform_audit_log_tenant_idx` ON `platform_audit_log` (`tenant_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `staff_auth_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`staff_id` integer NOT NULL,
	`purpose` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`staff_id`) REFERENCES `tenant_staff`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `staff_auth_tokens_token_hash_unique` ON `staff_auth_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `staff_auth_tokens_staff_idx` ON `staff_auth_tokens` (`staff_id`);--> statement-breakpoint
ALTER TABLE `tenants` ADD `billing_mode` text DEFAULT 'SELF_SERVE' NOT NULL;--> statement-breakpoint
ALTER TABLE `tenants` ADD `internal_notes` text;--> statement-breakpoint
ALTER TABLE `tenants` ADD `created_by_admin_id` integer;