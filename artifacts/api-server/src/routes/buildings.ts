import { Router } from "express";
import { db } from "@workspace/db";
import { buildingsTable, blocksTable, apartmentsTable, quartersTable } from "@workspace/db/schema";
import { eq, count, sql } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res) => {
  const { quarterId } = req.query;

  const buildings = await db
    .select({
      id: buildingsTable.id,
      name: buildingsTable.name,
      quarterId: buildingsTable.quarterId,
      quarterName: quartersTable.name,
      createdAt: buildingsTable.createdAt,
    })
    .from(buildingsTable)
    .leftJoin(quartersTable, eq(buildingsTable.quarterId, quartersTable.id))
    .where(quarterId ? eq(buildingsTable.quarterId, Number(quarterId)) : undefined)
    .orderBy(quartersTable.name, buildingsTable.name);

  const blocks = await db.select().from(blocksTable);
  const aptCounts = await db
    .select({ blockId: apartmentsTable.blockId, cnt: count() })
    .from(apartmentsTable)
    .groupBy(apartmentsTable.blockId);

  const aptMap = Object.fromEntries(aptCounts.map((c) => [c.blockId, Number(c.cnt)]));

  const result = buildings.map((b) => {
    const bBlocks = blocks.filter((bl) => bl.buildingId === b.id);
    const totalApts = bBlocks.reduce((s, bl) => s + (aptMap[bl.id] ?? 0), 0);
    return {
      ...b,
      blockCount: bBlocks.length,
      apartmentCount: totalApts,
      blocks: bBlocks.map((bl) => ({ ...bl, apartmentCount: aptMap[bl.id] ?? 0 })),
    };
  });

  res.json(result);
});

router.post("/", async (req, res) => {
  const { quarterId, name } = req.body;
  const [building] = await db
    .insert(buildingsTable)
    .values({ quarterId: quarterId ? Number(quarterId) : null, name })
    .returning();
  res.status(201).json({ ...building, blockCount: 0, apartmentCount: 0, blocks: [], quarterName: null });
});

router.delete("/:id", async (req, res) => {
  await db.delete(buildingsTable).where(eq(buildingsTable.id, Number(req.params.id)));
  res.status(204).send();
});

export default router;
