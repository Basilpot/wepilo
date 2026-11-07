CREATE TABLE `payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`booking_id` integer NOT NULL,
	`provider` text NOT NULL,
	`kind` text DEFAULT 'FULL' NOT NULL,
	`amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`provider_ref` text,
	`provider_payment_id` text,
	`note` text,
	`paid_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `payments_tenant_idx` ON `payments` (`tenant_id`,`status`);--> statement-breakpoint
CREATE INDEX `payments_booking_idx` ON `payments` (`booking_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `payments_provider_ref_uidx` ON `payments` (`provider_ref`);--> statement-breakpoint
CREATE TABLE `tenant_payment_settings` (
	`tenant_id` integer PRIMARY KEY NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`stripe_enabled` integer DEFAULT false NOT NULL,
	`stripe_secret_key_enc` text,
	`stripe_webhook_secret_enc` text,
	`stripe_webhook_id` text,
	`stripe_account_name` text,
	`stripe_live` integer DEFAULT false NOT NULL,
	`stripe_verified_at` integer,
	`bank_enabled` integer DEFAULT false NOT NULL,
	`bank_instructions` text,
	`deposit_percent` integer,
	`auto_confirm` integer DEFAULT false NOT NULL,
	`last_error` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `bookings` ADD `currency` text DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `public_token` text;