import { pgTable, serial, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const objectsTable = pgTable("objects_garages", {
  id: serial("id").primaryKey(),
  number: text("number").notNull(),
  area: numeric("area", { precision: 10, scale: 2 }).notNull(),
  type: text("type", { enum: ["object", "garage"] }).notNull(),
  status: text("status", { enum: ["available", "sold", "rented"] }).notNull().default("available"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertObjectSchema = createInsertSchema(objectsTable).omit({ id: true, createdAt: true });
export type InsertObject = z.infer<typeof insertObjectSchema>;
export type ObjectGarage = typeof objectsTable.$inferSelect;
