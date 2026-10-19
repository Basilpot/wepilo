ALTER TABLE `activities` ADD `group_discount` text;--> statement-breakpoint
ALTER TABLE `activities` ADD `show_group_discount` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `activities` ADD `altitude_chart` text;