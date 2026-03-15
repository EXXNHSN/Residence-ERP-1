import { Router } from "express";
import { db } from "@workspace/db";
import { objectsTable, tariffsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router = Router();

async function getPricePerSqm(type: string): Promise<number> {
  const key = type === "garage" ? "garage_price_per_sqm" : "object_price_per_sqm";
  const tariff = await db.select().from(tariffsTable).where(eq(tariffsTable.key, key));
  return tariff.length ? Number(tariff[0].value) : 800;
}

function enrichObject(obj: typeof objectsTable.$inferSelect, pricePerSqm: number) {
  const area = Number(obj.area);
  return { ...obj, area, pricePerSqm, totalPrice: area * pricePerSqm };
}

router.get("/", async (req, res) => {
  const { type, status } = req.query;
  const conditions: ReturnType<typeof eq>[] = [];
  if (type) conditions.push(eq(objectsTable.type, type as string));
  if (status) conditions.push(eq(objectsTable.status, status as string));

  const objs = await db
    .select()
    .from(objectsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(objectsTable.type, objectsTable.number);

  const results = await Promise.all(
    objs.map(async (obj) => enrichObject(obj, await getPricePerSqm(obj.type)))
  );
  res.json(results);
});

router.post("/", async (req, res) => {
  const { number, area, type } = req.body;
  const [obj] = await db
    .insert(objectsTable)
    .values({ number, area: String(area), type })
    .returning();
  const pricePerSqm = await getPricePerSqm(type);
  res.status(201).json(enrichObject(obj, pricePerSqm));
});

export default router;
