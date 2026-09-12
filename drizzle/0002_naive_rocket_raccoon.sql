CREATE TABLE `atlas_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_atlas_projects_name` ON `atlas_projects` (`name`);--> statement-breakpoint
ALTER TABLE `atlas_trips` ADD `project_id` text REFERENCES atlas_projects(id);--> statement-breakpoint
ALTER TABLE `atlas_trips` ADD `author` text DEFAULT '' NOT NULL;