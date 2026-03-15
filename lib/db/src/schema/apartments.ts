import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { blocksTable } from "./blocks";

export const apartmentsTable = pgTable("apartments", {
  id: serial("id").primaryKey(),
  blockId: integer("block_id").notNull().references(() => blocksTable.id),
  number: text("number").notNull(),
  floor: integer("floor").notNull(),
  area: numeric("area", { precision: 10, scale: 2 }).notNull(),
  status: text("status", { enum: ["available", "sold", "reserved"] }).notNull().default("available"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertApartmentSchema = createInsertSchema(apartmentsTable).omit({ id: true, createdAt: true });
export type InsertApartment = z.infer<typeof insertApartmentSchema>;
export type Apartment = typeof apartmentsTable.$inferSelect;
