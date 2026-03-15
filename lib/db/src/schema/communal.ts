import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const communalBillsTable = pgTable("communal_bills", {
  id: serial("id").primaryKey(),
  assetType: text("asset_type", { enum: ["apartment", "object", "garage"] }).notNull(),
  assetId: integer("asset_id").notNull(),
  ownerCustomerId: integer("owner_customer_id"),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  area: numeric("area", { precision: 10, scale: 2 }).notNull(),
  tariff: numeric("tariff", { precision: 10, scale: 4 }).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  status: text("status", { enum: ["pending", "paid", "overdue"] }).notNull().default("pending"),
  paidDate: timestamp("paid_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCommunalBillSchema = createInsertSchema(communalBillsTable).omit({ id: true, createdAt: true });
export type InsertCommunalBill = z.infer<typeof insertCommunalBillSchema>;
export type CommunalBill = typeof communalBillsTable.$inferSelect;
