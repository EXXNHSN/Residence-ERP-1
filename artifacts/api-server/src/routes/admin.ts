import { Router } from "express";
import { db } from "@workspace/db";
import { quartersTable, buildingsTable, blocksTable, apartmentsTable, tariffsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

// --- Type definitions ---

interface FloorRange {
  fromFloor: number;
  toFloor: number;
  apartmentsPerFloor: number;
  area: number;
  rooms: number;
}

// Per-floor config (more granular than ranges)
interface FloorConfig {
  floor: number;
  apartmentsPerFloor: number;
  area: number;    // default area for all apts on this floor
  rooms: number;   // default rooms for all apts on this floor
}

interface BlockInput {
  name: string;
  floorRanges?: FloorRange[];
  floorConfig?: FloorConfig[];
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

// Generate apartments from floor ranges (legacy)
function generateFromRanges(blockId: number, floorRanges: FloorRange[]) {
  const apartments: {
    blockId: number; number: string; floor: number; rooms: number; area: string; status: "available";
  }[] = [];

  for (const range of floorRanges) {
    for (let floor = range.fromFloor; floor <= range.toFloor; floor++) {
      for (let apt = 1; apt <= range.apartmentsPerFloor; apt++) {
        apartments.push({
          blockId,
          number: `${floor}${String(apt).padStart(2, "0")}`,
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

// Generate apartments from per-floor config (new, more granular)
function generateFromFloorConfig(blockId: number, floorConfig: FloorConfig[]) {
  const apartments: {
    blockId: number; number: string; floor: number; rooms: number; area: string; status: "available";
  }[] = [];

  for (const fc of floorConfig) {
    for (let apt = 1; apt <= fc.apartmentsPerFloor; apt++) {
      apartments.push({
        blockId,
        number: `${fc.floor}${String(apt).padStart(2, "0")}`,
        floor: fc.floor,
        rooms: fc.rooms,
        area: String(fc.area),
        status: "available",
      });
    }
  }
  return apartments;
}

function generateApartments(blockId: number, block: BlockInput) {
  if (block.floorConfig && block.floorConfig.length > 0) {
    return generateFromFloorConfig(blockId, block.floorConfig);
  }
  if (block.floorRanges && block.floorRanges.length > 0) {
    return generateFromRanges(blockId, block.floorRanges);
  }
  return [];
}

function totalFloors(block: BlockInput): number {
  if (block.floorConfig && block.floorConfig.length > 0) {
    return block.floorConfig.reduce((m, fc) => Math.max(m, fc.floor), 0);
  }
  if (block.floorRanges && block.floorRanges.length > 0) {
    return block.floorRanges.reduce((m, r) => Math.max(m, r.toFloor), 0);
  }
  return 1;
}

// --- Routes ---

// Bulk project setup — Kvartal → Bina → Blok → Apartments
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
        const floors = totalFloors(blData);
        const [block] = await db
          .insert(blocksTable)
          .values({ name: blData.name, buildingId: building.id, quarterId: quarter.id, floors })
          .returning();

        const apartments = generateApartments(block.id, blData);
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

// Get full project structure
router.get("/structure", async (_req, res) => {
  const quarters = await db.select().from(quartersTable).orderBy(quartersTable.name);
  const buildings = await db.select().from(buildingsTable).orderBy(buildingsTable.name);
  const blocks = await db.select().from(blocksTable).orderBy(blocksTable.name);

  const structure = quarters.map((q) => ({
    ...q,
    buildings: buildings
      .filter((b) => b.quarterId === q.id)
      .map((b) => ({ ...b, blocks: blocks.filter((bl) => bl.buildingId === b.id) })),
  }));

  res.json({ quarters: structure });
});

// Add a single block to a building — supports both floorConfig and floorRanges
router.post("/blocks", async (req, res) => {
  const { buildingId, quarterId, name, floorConfig, floorRanges } = req.body as {
    buildingId: number;
    quarterId?: number;
    name: string;
    floorConfig?: FloorConfig[];
    floorRanges?: FloorRange[];
  };

  const blockInput: BlockInput = { name, floorConfig, floorRanges };
  const floors = totalFloors(blockInput);

  const [block] = await db
    .insert(blocksTable)
    .values({ name, buildingId: Number(buildingId), quarterId: quarterId ? Number(quarterId) : null, floors })
    .returning();

  const apartments = generateApartments(block.id, blockInput);
  if (apartments.length > 0) {
    await db.insert(apartmentsTable).values(apartments);
  }

  res.status(201).json({ ...block, apartmentCount: apartments.length });
});

// Project settings
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
