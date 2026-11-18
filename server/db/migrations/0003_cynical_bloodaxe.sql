CREATE TABLE `cards` (
	`id` text PRIMARY KEY NOT NULL,
	`hit_id` text NOT NULL,
	`due_at` integer NOT NULL,
	`stability` real DEFAULT 0 NOT NULL,
	`stability_fast` real DEFAULT 0 NOT NULL,
	`difficulty` real DEFAULT 0 NOT NULL,
	`state` integer DEFAULT 0 NOT NULL,
	`schedule_status` text DEFAULT 'new' NOT NULL,
	`last_review_at` integer,
	`reps` integer DEFAULT 0 NOT NULL,
	`lapses` integer DEFAULT 0 NOT NULL,
	`scheduled_days` real DEFAULT 0 NOT NULL,
	`learning_step` integer DEFAULT 0 NOT NULL,
	`suspended` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`hit_id`) REFERENCES `mistake_hits`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cards_hit_id_unique` ON `cards` (`hit_id`);--> statement-breakpoint
CREATE INDEX `cards_due_idx` ON `cards` (`suspended`,`due_at`);--> statement-breakpoint
CREATE TABLE `quizzes` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`card_ids` text NOT NULL,
	`finished_at` integer,
	`score` real
);
--> statement-breakpoint
CREATE TABLE `review_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`card_id` text NOT NULL,
	`rating` integer NOT NULL,
	`state` integer NOT NULL,
	`schedule_status` text NOT NULL,
	`due_at` integer NOT NULL,
	`stability` real NOT NULL,
	`stability_fast` real NOT NULL,
	`difficulty` real NOT NULL,
	`scheduled_days` real NOT NULL,
	`learning_step` integer NOT NULL,
	`last_review_at` integer,
	`reviewed_at` integer NOT NULL,
	`is_quiz` integer DEFAULT false NOT NULL,
	`quiz_id` text,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `review_logs_card_idx` ON `review_logs` (`card_id`);--> statement-breakpoint
CREATE INDEX `review_logs_time_idx` ON `review_logs` (`reviewed_at`);