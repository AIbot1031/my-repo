CREATE TABLE `favorites` (
	`owner` text NOT NULL,
	`drink` text NOT NULL,
	`timestamp` text NOT NULL,
	PRIMARY KEY(`owner`, `drink`)
);
--> statement-breakpoint
CREATE TABLE `imports` (
	`id` text PRIMARY KEY NOT NULL,
	`timestamp` text NOT NULL
);
