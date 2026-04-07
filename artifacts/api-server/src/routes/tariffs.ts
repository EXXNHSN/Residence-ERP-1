import { Router } from "express";
import { db } from "@workspace/db";
import { tariffsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

const DEFAULT_TARIFFS = {
  communal_tariff: "0.5",
  apartment_price_per_sqm: "1000",
  object_price_per_sqm: "800",
  object_monthly_rent: "500",
  garage_price_per_sqm: "500",
  garage_sale_price: "5000",
  garage_monthly_rent: "100",
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

function buildResponse(map: Record<string, number>) {
  return {
    communalTariff: map.communal_tariff ?? 0.5,
    apartmentPricePerSqm: map.apartment_price_per_sqm ?? 1000,
    objectPricePerSqm: map.object_price_per_sqm ?? 800,
    objectMonthlyRent: map.object_monthly_rent ?? 500,
    garagePricePerSqm: map.garage_price_per_sqm ?? 500,
    garageSalePrice: map.garage_sale_price ?? 5000,
    garageMonthlyRent: map.garage_monthly_rent ?? 100,
  };
}

router.get("/", async (_req, res) => {
  const map = await getTariffsMap();
  res.json(buildResponse(map));
});

router.put("/", async (req, res) => {
  const {
    communalTariff, apartmentPricePerSqm, objectPricePerSqm, objectMonthlyRent,
    garagePricePerSqm, garageSalePrice, garageMonthlyRent
  } = req.body;

  const updates: Record<string, string> = {};
  if (communalTariff != null)        updates["communal_tariff"]         = String(communalTariff);
  if (apartmentPricePerSqm != null)  updates["apartment_price_per_sqm"] = String(apartmentPricePerSqm);
  if (objectPricePerSqm != null)     updates["object_price_per_sqm"]    = String(objectPricePerSqm);
  if (objectMonthlyRent != null)     updates["object_monthly_rent"]     = String(objectMonthlyRent);
  if (garagePricePerSqm != null)     updates["garage_price_per_sqm"]    = String(garagePricePerSqm);
  if (garageSalePrice != null)       updates["garage_sale_price"]       = String(garageSalePrice);
  if (garageMonthlyRent != null)     updates["garage_monthly_rent"]     = String(garageMonthlyRent);

  for (const [key, value] of Object.entries(updates)) {
    const existing = await db.select().from(tariffsTable).where(eq(tariffsTable.key, key));
    if (existing.length > 0) {
      await db.update(tariffsTable).set({ value, updatedAt: new Date() }).where(eq(tariffsTable.key, key));
    } else {
      await db.insert(tariffsTable).values({ key, value });
    }
  }

  const map = await getTariffsMap();
  res.json(buildResponse(map));
});

export default router;
