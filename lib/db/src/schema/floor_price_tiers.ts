import { pgTable, serial, integer, numeric, timestamp } from "drizzle-orm/pg-core";

export const floorPriceTiersTable = pgTable("floor_price_tiers", {
  id: serial("id").primaryKey(),
  floorFrom: integer("floor_from").notNull(),
  floorTo: integer("floor_to").notNull(),
  pricePerSqm: numeric("price_per_sqm", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type FloorPriceTier = typeof floorPriceTiersTable.$inferSelect;
