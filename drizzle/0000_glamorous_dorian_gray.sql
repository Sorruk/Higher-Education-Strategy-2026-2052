CREATE TABLE `actions` (
	`id` text PRIMARY KEY NOT NULL,
	`number` integer NOT NULL,
	`title_ru` text NOT NULL,
	`title_tm` text NOT NULL,
	`area` text NOT NULL,
	`owner_text` text NOT NULL,
	`organization_id` text,
	`year` integer NOT NULL,
	`due_date` text,
	`deadline_text` text DEFAULT '' NOT NULL,
	`expected` text NOT NULL,
	`status` text DEFAULT 'unknown' NOT NULL,
	`progress` integer,
	`priority` text DEFAULT 'normal' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`source_id` text,
	`source_locator` text DEFAULT '' NOT NULL,
	`verification` text DEFAULT 'draft' NOT NULL,
	`evidence_id` text,
	`version` integer DEFAULT 1 NOT NULL,
	`archived` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`evidence_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `audit` (
	`id` text PRIMARY KEY NOT NULL,
	`entity` text NOT NULL,
	`entity_id` text NOT NULL,
	`operation` text NOT NULL,
	`before_json` text,
	`after_json` text,
	`actor` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`title_ru` text NOT NULL,
	`title_tm` text NOT NULL,
	`filename` text NOT NULL,
	`kind` text NOT NULL,
	`verification` text NOT NULL,
	`size` integer NOT NULL,
	`sha256` text NOT NULL,
	`parts` text DEFAULT '[]' NOT NULL,
	`storage_key` text,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `indicators` (
	`id` text PRIMARY KEY NOT NULL,
	`number` integer NOT NULL,
	`title_ru` text NOT NULL,
	`title_tm` text NOT NULL,
	`unit` text NOT NULL,
	`unit_type` text NOT NULL,
	`source_id` text,
	`source_locator` text NOT NULL,
	`verification` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `members` (
	`email` text PRIMARY KEY NOT NULL,
	`role` text NOT NULL,
	`name` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `observations` (
	`id` text PRIMARY KEY NOT NULL,
	`indicator_id` text NOT NULL,
	`year` integer NOT NULL,
	`scope` text DEFAULT 'national' NOT NULL,
	`value` real NOT NULL,
	`evidence_id` text NOT NULL,
	`notes` text NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`indicator_id`) REFERENCES `indicators`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`evidence_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `observation_scope` ON `observations` (`indicator_id`,`year`,`scope`);--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`name_ru` text NOT NULL,
	`name_tm` text NOT NULL,
	`type` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`action_id` text,
	`organization_id` text,
	`period` text NOT NULL,
	`body` text NOT NULL,
	`evidence_id` text,
	`status` text NOT NULL,
	`author` text NOT NULL,
	`reviewer` text,
	`review_note` text DEFAULT '' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`action_id`) REFERENCES `actions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`evidence_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `targets` (
	`id` text PRIMARY KEY NOT NULL,
	`indicator_id` text NOT NULL,
	`year` integer NOT NULL,
	`value` text NOT NULL,
	FOREIGN KEY (`indicator_id`) REFERENCES `indicators`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `target_indicator_year` ON `targets` (`indicator_id`,`year`);