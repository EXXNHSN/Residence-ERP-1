import { Router } from "express";
import { db } from "@workspace/db";
import { quartersTable, buildingsTable, blocksTable, apartmentsTable } from "@workspace/db/schema";
import { eq, sql, count } from "drizzle-orm";

const router = Router();

router.get("/", async (_req, res) => {
  const quarters = await db
    .select({ id: quartersTable.id, name: quartersTable.name, description: quartersTable.description, createdAt: quartersTable.createdAt })
    .from(quartersTable)
    .orderBy(quartersTable.name);

  const buildings = await db.select().from(buildingsTable);
  const blocks = await db.select().from(blocksTable);
  const aptCounts = await db.select({ blockId: apartmentsTable.blockId, cnt: count() }).from(apartmentsTable).groupBy(apartmentsTable.blockId);
  const aptMap = Object.fromEntries(aptCounts.map((c) => [c.blockId, Number(c.cnt)]));

  const result = quarters.map((q) => {
    const qBuildings = buildings.filter((b) => b.quarterId === q.id);
    const qBlocks = blocks.filter((bl) => qBuildings.some((b) => b.id === bl.buildingId) || bl.quarterId === q.id);
    const apartmentCount = qBlocks.reduce((s, bl) => s + (aptMap[bl.id] ?? 0), 0);
    return { ...q, buildingCount: qBuildings.length, apartmentCount };
  });

  res.json(result);
});

router.post("/", async (req, res) => {
  const { name, description } = req.body;
  const [quarter] = await db.insert(quartersTable).values({ name, description }).returning();
  res.status(201).json({ ...quarter, buildingCount: 0, apartmentCount: 0 });
});

router.delete("/:id", async (req, res) => {
  await db.delete(quartersTable).where(eq(quartersTable.id, Number(req.params.id)));
  res.status(204).send();
});

export default router;
