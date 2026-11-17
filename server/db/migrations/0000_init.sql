CREATE TABLE `attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`client_attempt_id` text NOT NULL,
	`kind` text NOT NULL,
	`topic_id` text,
	`attempt_group_id` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`status` text NOT NULL,
	`text_or_transcript` text,
	`final_transcript` text,
	`duration_s` integer,
	`mime_type` text,
	`model` text,
	`prompt_version` text,
	`ai_json` text,
	`error` text,
	`self_rating` integer,
	`filler_count` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`confirmed_at` integer,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attempts_client_attempt_id_unique` ON `attempts` (`client_attempt_id`);--> statement-breakpoint
CREATE INDEX `attempts_created_idx` ON `attempts` (`created_at`);--> statement-breakpoint
CREATE INDEX `attempts_group_idx` ON `attempts` (`attempt_group_id`);--> statement-breakpoint
CREATE TABLE `mistake_hits` (
	`id` text PRIMARY KEY NOT NULL,
	`mistake_id` text NOT NULL,
	`attempt_id` text NOT NULL,
	`issue_index` integer NOT NULL,
	`original_quote` text NOT NULL,
	`correction` text NOT NULL,
	FOREIGN KEY (`mistake_id`) REFERENCES `mistakes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`attempt_id`) REFERENCES `attempts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mistake_hits_attempt_issue_uq` ON `mistake_hits` (`attempt_id`,`issue_index`);--> statement-breakpoint
CREATE INDEX `mistake_hits_mistake_idx` ON `mistake_hits` (`mistake_id`);--> statement-breakpoint
CREATE TABLE `mistakes` (
	`id` text PRIMARY KEY NOT NULL,
	`pattern_key` text NOT NULL,
	`label_vi` text NOT NULL,
	`example_wrong` text DEFAULT '' NOT NULL,
	`example_right` text DEFAULT '' NOT NULL,
	`category` text DEFAULT 'other' NOT NULL,
	`first_seen` integer NOT NULL,
	`last_seen` integer NOT NULL,
	`hit_count` integer DEFAULT 0 NOT NULL,
	`is_focus` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mistakes_pattern_key_unique` ON `mistakes` (`pattern_key`);--> statement-breakpoint
CREATE TABLE `rate_counters` (
	`key` text PRIMARY KEY NOT NULL,
	`window_start` integer NOT NULL,
	`count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `topics` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`prompt` text NOT NULL,
	`level` text DEFAULT 'B1' NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);