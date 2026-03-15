import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { customersTable } from "./customers";

export const internetSubscriptionsTable = pgTable("internet_subscriptions", {
  id: serial("id").primaryKey(),
  assetType: text("asset_type", { enum: ["apartment", "object", "garage"] }).notNull(),
  assetId: integer("asset_id").notNull(),
  customerId: integer("customer_id").notNull().references(() => customersTable.id),
  packageName: text("package_name").notNull(),
  monthlyPrice: numeric("monthly_price", { precision: 10, scale: 2 }).notNull(),
  startDate: timestamp("start_date").notNull(),
  expiryDate: timestamp("expiry_date").notNull(),
  status: text("status", { enum: ["active", "expired", "cancelled"] }).notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertInternetSubscriptionSchema = createInsertSchema(internetSubscriptionsTable).omit({ id: true, createdAt: true });
export type InsertInternetSubscription = z.infer<typeof insertInternetSubscriptionSchema>;
export type InternetSubscription = typeof internetSubscriptionsTable.$inferSelect;
