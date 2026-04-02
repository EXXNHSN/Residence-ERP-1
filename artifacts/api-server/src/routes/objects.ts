import { Router } from "express";
import { db } from "@workspace/db";
import { objectsTable, tariffsTable, blocksTable, quartersTable, buildingsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { verifyAdmin } from "./adminVerify";

const router = Router();

async function getGarageFixedPrices(): Promise<{ salePrice: number; monthlyRent: number }> {
  const rows = await db.select().from(tariffsTable).where(
    eq(tariffsTable.key, "garage_sale_price")
  );
  const rentRows = await db.select().from(tariffsTable).where(
    eq(tariffsTable.key, "garage_monthly_rent")
  );
  return {
    salePrice: rows.length ? Number(rows[0].value) : 5000,
    monthlyRent: rentRows.length ? Number(rentRows[0].value) : 100,
  };
}

async function getPricePerSqm(type: string): Promise<number> {
  const key = type === "garage" ? "garage_price_per_sqm" : "object_price_per_sqm";
  const tariff = await db.select().from(tariffsTable).where(eq(tariffsTable.key, key));
  return tariff.length ? Number(tariff[0].value) : 800;
}

async function enrichObject(obj: typeof objectsTable.$inferSelect, garageFixedPrices: { salePrice: number; monthlyRent: number }, pricePerSqmFallback: number) {
  const area = Number(obj.area);
  let blockName: string | null = null;
  let quarterName: string | null = null;
  let buildingName: string | null = null;
  let quarterId: number | null = null;
  let buildingId: number | null = null;

  if (obj.blockId) {
    const rows = await db
      .select({
        blockName: blocksTable.name,
        quarterName: quartersTable.name,
        buildingName: buildingsTable.name,
        quarterId: quartersTable.id,
        buildingId: buildingsTable.id,
      })
      .from(blocksTable)
      .leftJoin(buildingsTable, eq(blocksTable.buildingId, buildingsTable.id))
      .leftJoin(quartersTable, eq(blocksTable.quarterId, quartersTable.id))
      .where(eq(blocksTable.id, obj.blockId))
      .limit(1);
    if (rows[0]) {
      blockName = rows[0].blockName ?? null;
      quarterName = rows[0].quarterName ?? null;
      buildingName = rows[0].buildingName ?? null;
      quarterId = rows[0].quarterId ?? null;
      buildingId = rows[0].buildingId ?? null;
    }
  }

  if (obj.type === "garage") {
    return {
      ...obj,
      area,
      parkingFloor: obj.parkingFloor,
      salePrice: garageFixedPrices.salePrice,
      monthlyRent: garageFixedPrices.monthlyRent,
      pricePerSqm: null,
      blockName,
      quarterName,
      buildingName,
      quarterId,
      buildingId,
    };
  }

  return {
    ...obj,
    area,
    parkingFloor: null,
    pricePerSqm: pricePerSqmFallback,
    salePrice: area * pricePerSqmFallback,
    monthlyRent: area * pricePerSqmFallback,
    blockName,
    quarterName,
    buildingName,
    quarterId,
    buildingId,
  };
}

router.get("/", async (req, res) => {
  const { type, status, blockId } = req.query;
  const conditions: ReturnType<typeof eq>[] = [];
  if (type) conditions.push(eq(objectsTable.type, type as string));
  if (status) conditions.push(eq(objectsTable.status, status as string));
  if (blockId) conditions.push(eq(objectsTable.blockId, Number(blockId)));

  const objs = await db
    .select()
    .from(objectsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(objectsTable.type, objectsTable.blockId, objectsTable.parkingFloor, objectsTable.number);

  const garageFixedPrices = await getGarageFixedPrices();
  const objectPricePerSqm = await getPricePerSqm("object");

  const results = await Promise.all(
    objs.map(async (obj) => enrichObject(obj, garageFixedPrices, obj.type === "garage" ? 0 : objectPricePerSqm))
  );
  res.json(results);
});

// Bulk garage setup for a block
router.post("/garage-setup", async (req, res) => {
  const { blockId, spotsPerFloor, floors } = req.body;
  if (!blockId || !spotsPerFloor) {
    return res.status(400).json({ error: "blockId and spotsPerFloor are required" });
  }

  const numFloors = floors ?? 2;
  const numSpots = Number(spotsPerFloor);

  // Check block exists
  const [block] = await db.select().from(blocksTable).where(eq(blocksTable.id, Number(blockId))).limit(1);
  if (!block) return res.status(404).json({ error: "Blok tapılmadı" });

  const spots: typeof objectsTable.$inferInsert[] = [];
  for (let floor = 1; floor <= numFloors; floor++) {
    for (let spot = 1; spot <= numSpots; spot++) {
      spots.push({
        type: "garage",
        number: `M${floor}-${String(spot).padStart(2, "0")}`,
        area: "0",
        blockId: Number(blockId),
        parkingFloor: floor,
        status: "available",
      });
    }
  }

  const inserted = await db.insert(objectsTable).values(spots).returning();
  const garageFixedPrices = await getGarageFixedPrices();
  const enriched = await Promise.all(inserted.map(o => enrichObject(o, garageFixedPrices, 0)));
  res.status(201).json({ count: enriched.length, garages: enriched });
});

router.post("/", async (req, res) => {
  const { number, area, type, blockId, activityType, parkingFloor } = req.body;
  const [obj] = await db
    .insert(objectsTable)
    .values({
      number,
      area: type === "garage" ? "0" : String(area),
      type,
      blockId: blockId ? Number(blockId) : null,
      activityType: activityType || null,
      parkingFloor: parkingFloor ? Number(parkingFloor) : null,
    })
    .returning();
  const garageFixedPrices = await getGarageFixedPrices();
  const pricePerSqm = await getPricePerSqm(type);
  res.status(201).json(await enrichObject(obj, garageFixedPrices, pricePerSqm));
});

router.put("/:id", async (req, res) => {
  const { username, password, number, area, blockId, activityType, parkingFloor } = req.body ?? {};
  if (!(await verifyAdmin(username, password, res))) return;

  const updates: any = {};
  if (number !== undefined) updates.number = String(number);
  if (area !== undefined && !isNaN(Number(area))) updates.area = String(Number(area));
  if ("blockId" in req.body) updates.blockId = blockId ? Number(blockId) : null;
  if ("activityType" in req.body) updates.activityType = activityType || null;
  if ("parkingFloor" in req.body) updates.parkingFloor = parkingFloor ? Number(parkingFloor) : null;

  const [updated] = await db
    .update(objectsTable)
    .set(updates)
    .where(eq(objectsTable.id, Number(req.params.id)))
    .returning();

  if (!updated) return res.status(404).json({ error: "Tapılmadı" });
  const garageFixedPrices = await getGarageFixedPrices();
  const pricePerSqm = await getPricePerSqm(updated.type);
  res.json(await enrichObject(updated, garageFixedPrices, pricePerSqm));
});

router.delete("/:id", async (req, res) => {
  const { username, password } = req.body ?? {};
  if (!(await verifyAdmin(username, password, res))) return;
  await db.delete(objectsTable).where(eq(objectsTable.id, Number(req.params.id)));
  res.status(204).send();
});

export default router;
