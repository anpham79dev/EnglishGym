CREATE TABLE `checkins` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`kind` text NOT NULL,
	`minutes` integer,
	`note` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `checkins_date_idx` ON `checkins` (`date`);--> statement-breakpoint
ALTER TABLE `attempts` ADD `source` text DEFAULT 'gemini' NOT NULL;--> statement-breakpoint
ALTER TABLE `mistakes` ADD `note` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `topics` ADD `tags` text DEFAULT '' NOT NULL;--> statement-breakpoint
-- SQLite cannot ADD COLUMN with an expression default; existing topics get 0, new rows get the time from the app.
ALTER TABLE `topics` ADD `created_at` integer DEFAULT 0 NOT NULL;