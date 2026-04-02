import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const rentalsTable = pgTable("rentals", {
  id: serial("id").primaryKey(),
  assetType: text("asset_type", { enum: ["object", "garage"] }).notNull(),
  assetId: integer("asset_id").notNull(),
  customerId: integer("customer_id"),
  contractNumber: text("contract_number"),
  tenantName: text("tenant_name"),
  tenantPhone: text("tenant_phone"),
  tenantFin: text("tenant_fin"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  monthlyAmount: numeric("monthly_amount", { precision: 12, scale: 2 }).notNull(),
  pricePerSqm: numeric("price_per_sqm", { precision: 10, scale: 2 }),
  status: text("status", { enum: ["active", "ended"] }).notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertRentalSchema = createInsertSchema(rentalsTable).omit({ id: true, createdAt: true });
export type InsertRental = z.infer<typeof insertRentalSchema>;
export type Rental = typeof rentalsTable.$inferSelect;
