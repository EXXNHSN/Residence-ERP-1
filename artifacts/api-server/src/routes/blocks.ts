import { Router } from "express";
import { db } from "@workspace/db";
import { blocksTable, apartmentsTable } from "@workspace/db/schema";
import { eq, count } from "drizzle-orm";

const router = Router();

router.get("/", async (_req, res) => {
  const blocks = await db.select().from(blocksTable).orderBy(blocksTable.name);
  const counts = await db
    .select({ blockId: apartmentsTable.blockId, cnt: count() })
    .from(apartmentsTable)
    .groupBy(apartmentsTable.blockId);

  const countMap = Object.fromEntries(counts.map((c) => [c.blockId, Number(c.cnt)]));

  res.json(blocks.map((b) => ({ ...b, apartmentCount: countMap[b.id] ?? 0 })));
});

router.post("/", async (req, res) => {
  const { name } = req.body;
  const [block] = await db.insert(blocksTable).values({ name }).returning();
  res.status(201).json({ ...block, apartmentCount: 0 });
});

export default router;
