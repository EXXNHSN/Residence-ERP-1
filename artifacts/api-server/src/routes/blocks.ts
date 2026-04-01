import { Router } from "express";
import { db } from "@workspace/db";
import { blocksTable, apartmentsTable, quartersTable } from "@workspace/db/schema";
import { eq, count } from "drizzle-orm";
import { verifyAdmin } from "./adminVerify";

const router = Router();

router.get("/", async (_req, res) => {
  const blocks = await db
    .select({
      id: blocksTable.id,
      name: blocksTable.name,
      quarterId: blocksTable.quarterId,
      floors: blocksTable.floors,
      createdAt: blocksTable.createdAt,
      quarterName: quartersTable.name,
    })
    .from(blocksTable)
    .leftJoin(quartersTable, eq(blocksTable.quarterId, quartersTable.id))
    .orderBy(quartersTable.name, blocksTable.name);

  const counts = await db
    .select({ blockId: apartmentsTable.blockId, cnt: count() })
    .from(apartmentsTable)
    .groupBy(apartmentsTable.blockId);

  const countMap = Object.fromEntries(counts.map((c) => [c.blockId, Number(c.cnt)]));

  res.json(blocks.map((b) => ({ ...b, apartmentCount: countMap[b.id] ?? 0 })));
});

router.post("/", async (req, res) => {
  const { name, quarterId, floors } = req.body;
  const [block] = await db
    .insert(blocksTable)
    .values({ name, quarterId: quarterId ? Number(quarterId) : null, floors: floors ? Number(floors) : 1 })
    .returning();
  res.status(201).json({ ...block, apartmentCount: 0, quarterName: null });
});

router.put("/:id", async (req, res) => {
  const { username, password, name } = req.body ?? {};
  if (!(await verifyAdmin(username, password, res))) return;
  if (!name?.trim()) return res.status(400).json({ error: "Ad boş ola bilməz" });
  const [updated] = await db
    .update(blocksTable)
    .set({ name: name.trim() })
    .where(eq(blocksTable.id, Number(req.params.id)))
    .returning();
  if (!updated) return res.status(404).json({ error: "Tapılmadı" });
  res.json(updated);
});

export default router;
