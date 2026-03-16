import { Router } from "express";
import { db } from "@workspace/db";
import { quartersTable, blocksTable, apartmentsTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";

const router = Router();

router.get("/", async (_req, res) => {
  const quarters = await db
    .select({
      id: quartersTable.id,
      name: quartersTable.name,
      description: quartersTable.description,
      createdAt: quartersTable.createdAt,
    })
    .from(quartersTable)
    .orderBy(quartersTable.name);

  const result = await Promise.all(
    quarters.map(async (q) => {
      const blocks = await db
        .select({ id: blocksTable.id })
        .from(blocksTable)
        .where(eq(blocksTable.quarterId, q.id));
      const blockIds = blocks.map((b) => b.id);
      let apartmentCount = 0;
      if (blockIds.length > 0) {
        const counts = await Promise.all(
          blockIds.map(async (bid) => {
            const [row] = await db
              .select({ count: sql<number>`count(*)` })
              .from(apartmentsTable)
              .where(eq(apartmentsTable.blockId, bid));
            return Number(row?.count ?? 0);
          })
        );
        apartmentCount = counts.reduce((a, b) => a + b, 0);
      }
      return { ...q, buildingCount: blocks.length, apartmentCount };
    })
  );

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
