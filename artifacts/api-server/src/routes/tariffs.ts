import { Router } from "express";
import { db } from "@workspace/db";
import { tariffsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

const DEFAULT_TARIFFS = {
  communal_tariff: "0.5",
  apartment_price_per_sqm: "1000",
  object_price_per_sqm: "800",
  garage_price_per_sqm: "500",
};

async function ensureTariffs() {
  for (const [key, value] of Object.entries(DEFAULT_TARIFFS)) {
    const existing = await db.select().from(tariffsTable).where(eq(tariffsTable.key, key));
    if (existing.length === 0) {
      await db.insert(tariffsTable).values({ key, value });
    }
  }
}

async function getTariffsMap() {
  await ensureTariffs();
  const tariffs = await db.select().from(tariffsTable);
  return Object.fromEntries(tariffs.map((t) => [t.key, Number(t.value)]));
}

router.get("/", async (_req, res) => {
  const map = await getTariffsMap();
  res.json({
    communalTariff: map.communal_tariff ?? 0.5,
    apartmentPricePerSqm: map.apartment_price_per_sqm ?? 1000,
    objectPricePerSqm: map.object_price_per_sqm ?? 800,
    garagePricePerSqm: map.garage_price_per_sqm ?? 500,
  });
});

router.put("/", async (req, res) => {
  const { communalTariff, apartmentPricePerSqm, objectPricePerSqm, garagePricePerSqm } = req.body;
  const updates: Record<string, string> = {};
  if (communalTariff != null) updates["communal_tariff"] = String(communalTariff);
  if (apartmentPricePerSqm != null) updates["apartment_price_per_sqm"] = String(apartmentPricePerSqm);
  if (objectPricePerSqm != null) updates["object_price_per_sqm"] = String(objectPricePerSqm);
  if (garagePricePerSqm != null) updates["garage_price_per_sqm"] = String(garagePricePerSqm);

  for (const [key, value] of Object.entries(updates)) {
    await db
      .update(tariffsTable)
      .set({ value, updatedAt: new Date() })
      .where(eq(tariffsTable.key, key));
  }

  const map = await getTariffsMap();
  res.json({
    communalTariff: map.communal_tariff ?? 0.5,
    apartmentPricePerSqm: map.apartment_price_per_sqm ?? 1000,
    objectPricePerSqm: map.object_price_per_sqm ?? 800,
    garagePricePerSqm: map.garage_price_per_sqm ?? 500,
  });
});

export default router;
