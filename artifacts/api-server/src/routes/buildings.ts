import { Router } from "express";
import { db } from "@workspace/db";
import { buildingsTable, blocksTable, apartmentsTable, quartersTable } from "@workspace/db/schema";
import { eq, count, sql } from "drizzle-orm";
import { verifyAdmin } from "./adminVerify";

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

router.put("/:id", async (req, res) => {
  const { username, password, name } = req.body ?? {};
  if (!(await verifyAdmin(username, password, res))) return;
  if (!name?.trim()) return res.status(400).json({ error: "Ad boş ola bilməz" });
  const [updated] = await db
    .update(buildingsTable)
    .set({ name: name.trim() })
    .where(eq(buildingsTable.id, Number(req.params.id)))
    .returning();
  if (!updated) return res.status(404).json({ error: "Tapılmadı" });
  res.json(updated);
});

router.delete("/:id", async (req, res) => {
  await db.delete(buildingsTable).where(eq(buildingsTable.id, Number(req.params.id)));
  res.status(204).send();
});

export default router;
