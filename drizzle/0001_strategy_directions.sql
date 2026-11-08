CREATE TABLE `directions` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`chapter` text NOT NULL,
	`position` integer NOT NULL,
	`kind` text NOT NULL,
	`lead_tm` text DEFAULT '' NOT NULL,
	`text_tm` text NOT NULL,
	`text_ru` text DEFAULT '' NOT NULL,
	`action_id` text,
	`status` text DEFAULT 'unknown' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`source_id` text,
	`source_locator` text DEFAULT '' NOT NULL,
	`verification` text DEFAULT 'draft' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`action_id`) REFERENCES `actions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `direction_code` ON `directions` (`code`);
