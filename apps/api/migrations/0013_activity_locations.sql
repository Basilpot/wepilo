CREATE TABLE `activity_locations` (
	`activity_id` integer NOT NULL,
	`location_id` integer NOT NULL,
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `activity_location_uidx` ON `activity_locations` (`activity_id`,`location_id`);--> statement-breakpoint
CREATE INDEX `activity_location_location_idx` ON `activity_locations` (`location_id`);
--> statement-breakpoint
-- Existing trips keep the country, region and city they already had.
INSERT OR IGNORE INTO `activity_locations` (`activity_id`, `location_id`)
SELECT `id`, `country_id` FROM `activities` WHERE `country_id` IS NOT NULL;--> statement-breakpoint
INSERT OR IGNORE INTO `activity_locations` (`activity_id`, `location_id`)
SELECT `id`, `region_id` FROM `activities` WHERE `region_id` IS NOT NULL;--> statement-breakpoint
INSERT OR IGNORE INTO `activity_locations` (`activity_id`, `location_id`)
SELECT `id`, `city_id` FROM `activities` WHERE `city_id` IS NOT NULL;
