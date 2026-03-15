import { pgTable, serial, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tariffsTable = pgTable("tariffs", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: numeric("value", { precision: 10, scale: 4 }).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTariffSchema = createInsertSchema(tariffsTable).omit({ id: true, updatedAt: true });
export type InsertTariff = z.infer<typeof insertTariffSchema>;
export type Tariff = typeof tariffsTable.$inferSelect;
