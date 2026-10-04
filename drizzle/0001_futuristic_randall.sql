CREATE TABLE `admin_login_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`attempts` integer NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `admin_login_limit_expiry` ON `admin_login_limits` (`expires`);--> statement-breakpoint
CREATE TABLE `admin_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`expires` integer NOT NULL,
	`credential_version` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `admin_session_expiry` ON `admin_sessions` (`expires`);