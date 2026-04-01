import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { quartersTable } from "./quarters";
import { buildingsTable } from "./buildings";

export const blocksTable = pgTable("blocks", {
  id: serial("id").primaryKey(),
  quarterId: integer("quarter_id").references(() => quartersTable.id),
  buildingId: integer("building_id").references(() => buildingsTable.id),
  name: text("name").notNull(),
  floors: integer("floors").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBlockSchema = createInsertSchema(blocksTable).omit({ id: true, createdAt: true });
export type InsertBlock = z.infer<typeof insertBlockSchema>;
export type Block = typeof blocksTable.$inferSelect;
