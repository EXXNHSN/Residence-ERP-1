import { Router } from "express";
import { db } from "@workspace/db";
import { objectsTable, tariffsTable, blocksTable, quartersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { verifyAdmin } from "./adminVerify";

const router = Router();

async function getPricePerSqm(type: string): Promise<number> {
  const key = type === "garage" ? "garage_price_per_sqm" : "object_price_per_sqm";
  const tariff = await db.select().from(tariffsTable).where(eq(tariffsTable.key, key));
  return tariff.length ? Number(tariff[0].value) : 800;
}

async function enrichObject(obj: typeof objectsTable.$inferSelect, pricePerSqm: number) {
  const area = Number(obj.area);
  let blockName: string | null = null;
  let quarterName: string | null = null;

  if (obj.blockId) {
    const rows = await db
      .select({ blockName: blocksTable.name, quarterName: quartersTable.name })
      .from(blocksTable)
      .leftJoin(quartersTable, eq(blocksTable.quarterId, quartersTable.id))
      .where(eq(blocksTable.id, obj.blockId))
      .limit(1);
    if (rows[0]) {
      blockName = rows[0].blockName ?? null;
      quarterName = rows[0].quarterName ?? null;
    }
  }

  return { ...obj, area, pricePerSqm, monthlyRent: area * pricePerSqm, blockName, quarterName };
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
  const { number, area, type, blockId, activityType } = req.body;
  const [obj] = await db
    .insert(objectsTable)
    .values({
      number,
      area: String(area),
      type,
      blockId: blockId ? Number(blockId) : null,
      activityType: activityType || null,
    })
    .returning();
  const pricePerSqm = await getPricePerSqm(type);
  res.status(201).json(await enrichObject(obj, pricePerSqm));
});

router.put("/:id", async (req, res) => {
  const { username, password, number, area, blockId, activityType } = req.body ?? {};
  if (!(await verifyAdmin(username, password, res))) return;

  const updates: any = {};
  if (number !== undefined) updates.number = String(number);
  if (area !== undefined && !isNaN(Number(area))) updates.area = String(Number(area));
  if ("blockId" in req.body) updates.blockId = blockId ? Number(blockId) : null;
  if ("activityType" in req.body) updates.activityType = activityType || null;

  const [updated] = await db
    .update(objectsTable)
    .set(updates)
    .where(eq(objectsTable.id, Number(req.params.id)))
    .returning();

  if (!updated) return res.status(404).json({ error: "Tapılmadı" });
  const pricePerSqm = await getPricePerSqm(updated.type);
  res.json(await enrichObject(updated, pricePerSqm));
});

router.delete("/:id", async (req, res) => {
  const { username, password } = req.body ?? {};
  if (!(await verifyAdmin(username, password, res))) return;
  await db.delete(objectsTable).where(eq(objectsTable.id, Number(req.params.id)));
  res.status(204).send();
});

export default router;
