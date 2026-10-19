-- Billing v2: paid $1 trial, Starter/Growth/Scale plans, webhook idempotency.
-- Columns are added in place (no table rebuild): rebuilding `tenants` on D1 would
-- cascade-delete every row that references it.
CREATE TABLE `billing_events` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`tenant_id` integer,
	`received_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `tenants` ADD `trial_used_at` integer;--> statement-breakpoint
ALTER TABLE `tenants` ADD `trial_email` text;--> statement-breakpoint
ALTER TABLE `tenants` ADD `expiry_notice_sent_at` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `tenants_trial_email_unique` ON `tenants` (`trial_email`);--> statement-breakpoint
ALTER TABLE `platform_subscriptions` ADD `interval` text;--> statement-breakpoint
UPDATE `tenants` SET `plan` = 'STARTER' WHERE `plan` = 'LAUNCH';--> statement-breakpoint
UPDATE `tenants` SET `plan` = 'GROWTH' WHERE `plan` = 'BUSINESS';--> statement-breakpoint
UPDATE `platform_subscriptions` SET `plan` = 'STARTER' WHERE `plan` = 'LAUNCH';--> statement-breakpoint
UPDATE `platform_subscriptions` SET `plan` = 'GROWTH' WHERE `plan` = 'BUSINESS';--> statement-breakpoint
-- Old free-trial rows have no Dodo subscription behind them; drop them so the new flow starts clean.
DELETE FROM `platform_subscriptions` WHERE `dodo_subscription_id` IS NULL;
