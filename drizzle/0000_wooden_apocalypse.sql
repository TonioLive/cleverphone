CREATE TABLE `inventory` (
	`sku` text PRIMARY KEY NOT NULL,
	`available` integer DEFAULT 0 NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "inventory_available_nonnegative" CHECK("inventory"."available" >= 0),
	CONSTRAINT "inventory_enabled_boolean" CHECK("inventory"."enabled" IN (0, 1))
);
--> statement-breakpoint
CREATE TABLE `order_lines` (
	`order_id` text NOT NULL,
	`sku` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_amount` integer NOT NULL,
	`product_name` text NOT NULL,
	PRIMARY KEY(`order_id`, `sku`),
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sku`) REFERENCES `inventory`(`sku`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "order_lines_quantity_valid" CHECK("order_lines"."quantity" BETWEEN 1 AND 5),
	CONSTRAINT "order_lines_amount_positive" CHECK("order_lines"."unit_amount" > 0)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`checkout_session_id` text,
	`access_token_hash` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`amount_total` integer NOT NULL,
	`currency` text DEFAULT 'eur' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "orders_amount_positive" CHECK("orders"."amount_total" > 0),
	CONSTRAINT "orders_status_valid" CHECK("orders"."status" IN ('pending', 'paid', 'expired', 'failed', 'payment_review'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_checkout_session_id_unique` ON `orders` (`checkout_session_id`);--> statement-breakpoint
CREATE TABLE `stripe_events` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`session_id` text NOT NULL,
	`received_at` text NOT NULL
);
