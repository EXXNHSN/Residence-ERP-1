import { Router } from "express";
import { db } from "@workspace/db";
import { apartmentsTable, blocksTable, tariffsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router = Router();

async function getApartmentPricePerSqm(): Promise<number> {
  const tariff = await db.select().from(tariffsTable).where(eq(tariffsTable.key, "apartment_price_per_sqm"));
  return tariff.length ? Number(tariff[0].value) : 1000;
}

async function enrichApartment(apt: typeof apartmentsTable.$inferSelect, blockName: string, pricePerSqm: number) {
  const area = Number(apt.area);
  return {
    id: apt.id,
    blockId: apt.blockId,
    blockName,
    number: apt.number,
    floor: apt.floor,
    area,
    status: apt.status,
    pricePerSqm,
    totalPrice: area * pricePerSqm,
  };
}

router.get("/", async (req, res) => {
  const { blockId, status } = req.query;
  const conditions: ReturnType<typeof eq>[] = [];

  if (blockId) conditions.push(eq(apartmentsTable.blockId, Number(blockId)));
  if (status) conditions.push(eq(apartmentsTable.status, status as string));

  const apts = await db
    .select({ apt: apartmentsTable, blockName: blocksTable.name })
    .from(apartmentsTable)
    .leftJoin(blocksTable, eq(apartmentsTable.blockId, blocksTable.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(apartmentsTable.blockId, apartmentsTable.number);

  const pricePerSqm = await getApartmentPricePerSqm();
  res.json(await Promise.all(apts.map((r) => enrichApartment(r.apt, r.blockName ?? "", pricePerSqm))));
});

router.post("/", async (req, res) => {
  const { blockId, number, floor, area } = req.body;
  const [apt] = await db
    .insert(apartmentsTable)
    .values({ blockId, number, floor, area: String(area) })
    .returning();
  const block = await db.select().from(blocksTable).where(eq(blocksTable.id, blockId)).limit(1);
  const pricePerSqm = await getApartmentPricePerSqm();
  res.status(201).json(await enrichApartment(apt, block[0]?.name ?? "", pricePerSqm));
});

router.get("/:id", async (req, res) => {
  const [row] = await db
    .select({ apt: apartmentsTable, blockName: blocksTable.name })
    .from(apartmentsTable)
    .leftJoin(blocksTable, eq(apartmentsTable.blockId, blocksTable.id))
    .where(eq(apartmentsTable.id, Number(req.params.id)));

  if (!row) return res.status(404).json({ error: "Not found" });
  const pricePerSqm = await getApartmentPricePerSqm();
  res.json(await enrichApartment(row.apt, row.blockName ?? "", pricePerSqm));
});

export default router;
