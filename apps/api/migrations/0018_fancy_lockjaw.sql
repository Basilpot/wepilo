DROP TABLE `payments`;--> statement-breakpoint
ALTER TABLE `tenant_payment_settings` DROP COLUMN `stripe_enabled`;--> statement-breakpoint
ALTER TABLE `tenant_payment_settings` DROP COLUMN `stripe_secret_key_enc`;--> statement-breakpoint
ALTER TABLE `tenant_payment_settings` DROP COLUMN `stripe_webhook_secret_enc`;--> statement-breakpoint
ALTER TABLE `tenant_payment_settings` DROP COLUMN `stripe_webhook_id`;--> statement-breakpoint
ALTER TABLE `tenant_payment_settings` DROP COLUMN `stripe_account_name`;--> statement-breakpoint
ALTER TABLE `tenant_payment_settings` DROP COLUMN `stripe_live`;--> statement-breakpoint
ALTER TABLE `tenant_payment_settings` DROP COLUMN `stripe_verified_at`;--> statement-breakpoint
ALTER TABLE `tenant_payment_settings` DROP COLUMN `bank_enabled`;--> statement-breakpoint
ALTER TABLE `tenant_payment_settings` DROP COLUMN `bank_instructions`;--> statement-breakpoint
ALTER TABLE `tenant_payment_settings` DROP COLUMN `deposit_percent`;--> statement-breakpoint
ALTER TABLE `tenant_payment_settings` DROP COLUMN `auto_confirm`;--> statement-breakpoint
ALTER TABLE `tenant_payment_settings` DROP COLUMN `last_error`;