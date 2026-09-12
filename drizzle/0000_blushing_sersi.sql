CREATE TABLE `atlas_attempts` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `atlas_config` (
	`id` integer PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`salt` text NOT NULL,
	`password_hash` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `atlas_sessions` (
	`token` text PRIMARY KEY NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `atlas_trips` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`summary` text NOT NULL,
	`upload_id` text,
	`created_at` text NOT NULL
);
