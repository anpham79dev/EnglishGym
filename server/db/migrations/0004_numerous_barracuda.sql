CREATE TABLE `focus_log` (
	`id` text PRIMARY KEY NOT NULL,
	`mistake_id` text NOT NULL,
	`pattern_key` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer
);
--> statement-breakpoint
ALTER TABLE `attempts` ADD `is_benchmark` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `attempts` ADD `self_marked_count` integer;--> statement-breakpoint
ALTER TABLE `attempts` ADD `timed_result` text;--> statement-breakpoint
ALTER TABLE `mistake_hits` ADD `self_found` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `topics` ADD `prep_s` integer;--> statement-breakpoint
ALTER TABLE `topics` ADD `response_s` integer;