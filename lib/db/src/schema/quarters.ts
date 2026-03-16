import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const quartersTable = pgTable("quarters", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertQuarterSchema = createInsertSchema(quartersTable).omit({ id: true, createdAt: true });
export type InsertQuarter = z.infer<typeof insertQuarterSchema>;
export type Quarter = typeof quartersTable.$inferSelect;
