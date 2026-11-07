CREATE TABLE `tenant_email_config` (
	`tenant_id` integer PRIMARY KEY NOT NULL,
	`resend_api_key_enc` text,
	`from_email` text,
	`from_name` text,
	`reply_to` text,
	`inquiry_recipients` text DEFAULT '[]' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`verified_at` integer,
	`last_error` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
