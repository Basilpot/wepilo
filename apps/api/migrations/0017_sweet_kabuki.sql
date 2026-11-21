PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_tenants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`password` text,
	`company_name` text,
	`company_logo` text,
	`website` text,
	`company_description` text,
	`phone` text,
	`address` text,
	`slug` text NOT NULL,
	`custom_domain` text,
	`custom_domain_token` text,
	`custom_domain_verified_at` integer,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`plan` text DEFAULT 'STARTER' NOT NULL,
	`plan_expires_at` integer,
	`trial_used_at` integer,
	`trial_email` text,
	`expiry_notice_sent_at` integer,
	`billing_mode` text DEFAULT 'SELF_SERVE' NOT NULL,
	`internal_notes` text,
	`created_by_admin_id` integer,
	`api_key_hash` text,
	`dodo_customer_id` text,
	`site_config` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_tenants`("id", "email", "password", "company_name", "company_logo", "website", "company_description", "phone", "address", "slug", "custom_domain", "custom_domain_token", "custom_domain_verified_at", "status", "plan", "plan_expires_at", "trial_used_at", "trial_email", "expiry_notice_sent_at", "billing_mode", "internal_notes", "created_by_admin_id", "api_key_hash", "dodo_customer_id", "site_config", "created_at", "updated_at") SELECT "id", "email", "password", "company_name", "company_logo", "website", "company_description", "phone", "address", "slug", "custom_domain", "custom_domain_token", "custom_domain_verified_at", "status", "plan", "plan_expires_at", "trial_used_at", "trial_email", "expiry_notice_sent_at", "billing_mode", "internal_notes", "created_by_admin_id", "api_key_hash", "dodo_customer_id", "site_config", "created_at", "updated_at" FROM `tenants`;--> statement-breakpoint
DROP TABLE `tenants`;--> statement-breakpoint
ALTER TABLE `__new_tenants` RENAME TO `tenants`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `tenants_slug_unique` ON `tenants` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `tenants_custom_domain_unique` ON `tenants` (`custom_domain`);--> statement-breakpoint
CREATE UNIQUE INDEX `tenants_trial_email_unique` ON `tenants` (`trial_email`);--> statement-breakpoint
CREATE UNIQUE INDEX `tenants_api_key_hash_unique` ON `tenants` (`api_key_hash`);--> statement-breakpoint
CREATE INDEX `tenants_status_idx` ON `tenants` (`status`);--> statement-breakpoint
CREATE INDEX `tenant_staff_email_idx` ON `tenant_staff` (`email`);