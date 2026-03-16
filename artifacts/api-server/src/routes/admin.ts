import { Router } from "express";
import { db } from "@workspace/db";
import { quartersTable, blocksTable, apartmentsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

// Bulk project setup: create quarters, buildings, and apartments in one call
router.post("/setup", async (req, res) => {
  const { quarters } = req.body as {
    quarters: Array<{
      name: string;
      description?: string;
      buildings: Array<{
        name: string;
        floors: number;
        apartmentsPerFloor: number;
        apartmentArea: number;
        rooms: number;
      }>;
    }>;
  };

  if (!quarters || !Array.isArray(quarters)) {
    return res.status(400).json({ error: "quarters array is required" });
  }

  const results = [];

  for (const qData of quarters) {
    const [quarter] = await db
      .insert(quartersTable)
      .values({ name: qData.name, description: qData.description })
      .returning();

    const quarterBuildings = [];

    for (const bData of qData.buildings) {
      const [block] = await db
        .insert(blocksTable)
        .values({ name: bData.name, quarterId: quarter.id, floors: bData.floors })
        .returning();

      const apartments = [];
      for (let floor = 1; floor <= bData.floors; floor++) {
        for (let apt = 1; apt <= bData.apartmentsPerFloor; apt++) {
          const aptNumber = `${floor}${String(apt).padStart(2, "0")}`;
          apartments.push({
            blockId: block.id,
            number: aptNumber,
            floor,
            rooms: bData.rooms,
            area: String(bData.apartmentArea),
            status: "available" as const,
          });
        }
      }

      if (apartments.length > 0) {
        await db.insert(apartmentsTable).values(apartments);
      }

      quarterBuildings.push({ ...block, apartmentCount: apartments.length });
    }

    results.push({ ...quarter, buildings: quarterBuildings });
  }

  res.status(201).json({ quarters: results });
});

// Get full project structure
router.get("/structure", async (_req, res) => {
  const quarters = await db.select().from(quartersTable).orderBy(quartersTable.name);
  const blocks = await db.select().from(blocksTable).orderBy(blocksTable.name);

  const structure = quarters.map((q) => {
    const qBlocks = blocks.filter((b) => b.quarterId === q.id);
    return { ...q, buildings: qBlocks };
  });

  res.json({ quarters: structure });
});

// Add a single building to a quarter
router.post("/buildings", async (req, res) => {
  const { quarterId, name, floors, apartmentsPerFloor, apartmentArea, rooms } = req.body;

  const [block] = await db
    .insert(blocksTable)
    .values({ quarterId: Number(quarterId), name, floors: Number(floors) })
    .returning();

  const apartments = [];
  for (let floor = 1; floor <= Number(floors); floor++) {
    for (let apt = 1; apt <= Number(apartmentsPerFloor); apt++) {
      const aptNumber = `${floor}${String(apt).padStart(2, "0")}`;
      apartments.push({
        blockId: block.id,
        number: aptNumber,
        floor,
        rooms: Number(rooms) || 1,
        area: String(apartmentArea),
        status: "available" as const,
      });
    }
  }

  if (apartments.length > 0) {
    await db.insert(apartmentsTable).values(apartments);
  }

  res.status(201).json({ ...block, apartmentCount: apartments.length });
});

export default router;
