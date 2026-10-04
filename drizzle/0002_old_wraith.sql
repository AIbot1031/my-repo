CREATE TABLE `account_login_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`attempts` integer NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `account_login_limit_expiry` ON `account_login_limits` (`expires`);--> statement-breakpoint
CREATE TABLE `app_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`username_key` text NOT NULL,
	`password_salt` text NOT NULL,
	`password_hash` text NOT NULL,
	`password_iterations` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `app_users_username_key_unique` ON `app_users` (`username_key`);--> statement-breakpoint
CREATE TABLE `catalog_drinks` (
	`id` text PRIMARY KEY NOT NULL,
	`source_row` integer NOT NULL,
	`brand` text NOT NULL,
	`item_name` text NOT NULL,
	`price` real,
	`catalog_version` text NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `catalog_drinks_brand` ON `catalog_drinks` (`brand`);--> statement-breakpoint
CREATE INDEX `catalog_drinks_version` ON `catalog_drinks` (`catalog_version`);--> statement-breakpoint
CREATE TABLE `user_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`expires` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `app_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_sessions_expiry` ON `user_sessions` (`expires`);--> statement-breakpoint
CREATE INDEX `user_sessions_user` ON `user_sessions` (`user_id`);