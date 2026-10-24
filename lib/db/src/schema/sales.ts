import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { customersTable } from "./customers";

export const salesTable = pgTable("sales", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customersTable.id),
  assetType: text("asset_type", { enum: ["apartment", "object", "garage"] }).notNull(),
  assetId: integer("asset_id").notNull(),
  saleType: text("sale_type", { enum: ["cash", "credit"] }).notNull(),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  downPayment: numeric("down_payment", { precision: 12, scale: 2 }).notNull().default("0"),
  installmentMonths: integer("installment_months").notNull().default(0),
  monthlyPayment: numeric("monthly_payment", { precision: 12, scale: 2 }).notNull().default("0"),
  pricePerSqm: numeric("price_per_sqm", { precision: 12, scale: 2 }),
  contractNumber: text("contract_number"),
  qaimeNumber: text("qaime_number"),
  saleDate: timestamp("sale_date").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSaleSchema = createInsertSchema(salesTable).omit({ id: true, createdAt: true });
export type InsertSale = z.infer<typeof insertSaleSchema>;
export type Sale = typeof salesTable.$inferSelect;

export const saleTransfersTable = pgTable("sale_transfers", {
  id: serial("id").primaryKey(),
  saleId: integer("sale_id").notNull().references(() => salesTable.id, { onDelete: "cascade" }),
  fromCustomerId: integer("from_customer_id").notNull().references(() => customersTable.id),
  toCustomerId: integer("to_customer_id").notNull().references(() => customersTable.id),
  transferDate: timestamp("transfer_date").defaultNow().notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSaleTransferSchema = createInsertSchema(saleTransfersTable).omit({ id: true, createdAt: true });
export type InsertSaleTransfer = z.infer<typeof insertSaleTransferSchema>;
export type SaleTransfer = typeof saleTransfersTable.$inferSelect;
