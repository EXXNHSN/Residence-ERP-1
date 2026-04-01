import { Router } from "express";
import { db } from "@workspace/db";
import { quartersTable, buildingsTable, blocksTable, apartmentsTable, tariffsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

interface FloorRange {
  fromFloor: number;
  toFloor: number;
  apartmentsPerFloor: number;
  area: number;
  rooms: number;
}

interface BlockInput {
  name: string;
  floorRanges: FloorRange[];
}

interface BuildingInput {
  name: string;
  blocks: BlockInput[];
}

interface QuarterInput {
  name: string;
  description?: string;
  buildings: BuildingInput[];
}

function generateApartments(blockId: number, floorRanges: FloorRange[]) {
  const apartments: {
    blockId: number;
    number: string;
    floor: number;
    rooms: number;
    area: string;
    status: "available";
  }[] = [];

  for (const range of floorRanges) {
    for (let floor = range.fromFloor; floor <= range.toFloor; floor++) {
      for (let apt = 1; apt <= range.apartmentsPerFloor; apt++) {
        const aptNumber = `${floor}${String(apt).padStart(2, "0")}`;
        apartments.push({
          blockId,
          number: aptNumber,
          floor,
          rooms: range.rooms,
          area: String(range.area),
          status: "available",
        });
      }
    }
  }

  return apartments;
}

// Bulk project setup — Kvartal → Bina → Blok → Floor ranges → Apartments
router.post("/setup", async (req, res) => {
  const { quarters } = req.body as { quarters: QuarterInput[] };

  if (!quarters || !Array.isArray(quarters)) {
    return res.status(400).json({ error: "quarters array is required" });
  }

  const results = [];

  for (const qData of quarters) {
    const [quarter] = await db
      .insert(quartersTable)
      .values({ name: qData.name, description: qData.description })
      .returning();

    const resultBuildings = [];

    for (const bData of qData.buildings) {
      const [building] = await db
        .insert(buildingsTable)
        .values({ name: bData.name, quarterId: quarter.id })
        .returning();

      const resultBlocks = [];

      for (const blData of bData.blocks) {
        const totalFloors = blData.floorRanges.reduce((max, r) => Math.max(max, r.toFloor), 0);

        const [block] = await db
          .insert(blocksTable)
          .values({ name: blData.name, buildingId: building.id, quarterId: quarter.id, floors: totalFloors })
          .returning();

        const apartments = generateApartments(block.id, blData.floorRanges);

        if (apartments.length > 0) {
          await db.insert(apartmentsTable).values(apartments);
        }

        resultBlocks.push({ ...block, apartmentCount: apartments.length });
      }

      resultBuildings.push({ ...building, blocks: resultBlocks });
    }

    results.push({ ...quarter, buildings: resultBuildings });
  }

  res.status(201).json({ quarters: results });
});

// Get full project structure (kvartal → bina → blok)
router.get("/structure", async (_req, res) => {
  const quarters = await db.select().from(quartersTable).orderBy(quartersTable.name);
  const buildings = await db.select().from(buildingsTable).orderBy(buildingsTable.name);
  const blocks = await db.select().from(blocksTable).orderBy(blocksTable.name);

  const structure = quarters.map((q) => {
    const qBuildings = buildings.filter((b) => b.quarterId === q.id);
    return {
      ...q,
      buildings: qBuildings.map((b) => ({
        ...b,
        blocks: blocks.filter((bl) => bl.buildingId === b.id),
      })),
    };
  });

  res.json({ quarters: structure });
});

// Add a single block to a building
router.post("/blocks", async (req, res) => {
  const { buildingId, quarterId, name, floorRanges } = req.body as {
    buildingId: number;
    quarterId?: number;
    name: string;
    floorRanges: FloorRange[];
  };

  const totalFloors = (floorRanges || []).reduce((max: number, r: FloorRange) => Math.max(max, r.toFloor), 1);

  const [block] = await db
    .insert(blocksTable)
    .values({ name, buildingId: Number(buildingId), quarterId: quarterId ? Number(quarterId) : null, floors: totalFloors })
    .returning();

  const apartments = generateApartments(block.id, floorRanges || []);

  if (apartments.length > 0) {
    await db.insert(apartmentsTable).values(apartments);
  }

  res.status(201).json({ ...block, apartmentCount: apartments.length });
});

// Project settings (key-value store in tariffs table)
router.get("/settings", async (_req, res) => {
  const rows = await db.select().from(tariffsTable).orderBy(tariffsTable.key);
  const map: Record<string, string> = {};
  rows.forEach((r) => { map[r.key] = r.value; });
  res.json(map);
});

router.post("/settings", async (req, res) => {
  const settings: Record<string, string> = req.body;
  for (const [key, value] of Object.entries(settings)) {
    const existing = await db.select().from(tariffsTable).where(eq(tariffsTable.key, key)).limit(1);
    if (existing.length > 0) {
      await db.update(tariffsTable).set({ value: String(value), updatedAt: new Date() }).where(eq(tariffsTable.key, key));
    } else {
      await db.insert(tariffsTable).values({ key, value: String(value) });
    }
  }
  res.json({ ok: true });
});

export default router;
