import { sql } from "drizzle-orm";
import { check, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Confirmed, physically available inventory. The catalogue alone never permits a sale.
export const inventory = sqliteTable("inventory", {
  sku: text("sku").primaryKey(),
  available: integer("available").notNull().default(0),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  check("inventory_available_nonnegative", sql`${table.available} >= 0`),
  check("inventory_enabled_boolean", sql`${table.enabled} IN (0, 1)`),
]);

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  checkoutSessionId: text("checkout_session_id").unique(),
  accessTokenHash: text("access_token_hash").notNull().unique(),
  status: text("status").notNull().default("pending"),
  amountTotal: integer("amount_total").notNull(),
  currency: text("currency").notNull().default("eur"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  check("orders_amount_positive", sql`${table.amountTotal} > 0`),
  check("orders_status_valid", sql`${table.status} IN ('pending', 'paid', 'expired', 'failed', 'payment_review')`),
]);

export const orderLines = sqliteTable("order_lines", {
  orderId: text("order_id").notNull().references(() => orders.id),
  sku: text("sku").notNull().references(() => inventory.sku),
  quantity: integer("quantity").notNull(),
  unitAmount: integer("unit_amount").notNull(),
  productName: text("product_name").notNull(),
}, (table) => [
  primaryKey({ columns: [table.orderId, table.sku] }),
  check("order_lines_quantity_valid", sql`${table.quantity} BETWEEN 1 AND 5`),
  check("order_lines_amount_positive", sql`${table.unitAmount} > 0`),
]);

export const stripeEvents = sqliteTable("stripe_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  sessionId: text("session_id").notNull(),
  receivedAt: text("received_at").notNull(),
});
