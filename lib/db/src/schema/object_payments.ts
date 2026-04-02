import { pgTable, serial, integer, text, numeric, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { rentalsTable } from "./rentals";

export const objectPaymentsTable = pgTable("object_payments", {
  id: serial("id").primaryKey(),
  rentalId: integer("rental_id").notNull().references(() => rentalsTable.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  period: text("period").notNull(),
  paymentDate: date("payment_date"),
  status: text("status", { enum: ["paid", "pending"] }).notNull().default("pending"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertObjectPaymentSchema = createInsertSchema(objectPaymentsTable).omit({ id: true, createdAt: true });
export type InsertObjectPayment = z.infer<typeof insertObjectPaymentSchema>;
export type ObjectPayment = typeof objectPaymentsTable.$inferSelect;
