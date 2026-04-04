import { Router } from "express";
import { db } from "@workspace/db";
import { quartersTable, buildingsTable, blocksTable, apartmentsTable, tariffsTable } from "@workspace/db/schema";
import { eq, inArray } from "drizzle-orm";
import { verifyAdmin } from "./adminVerify";

const router = Router();

// --- Type definitions ---

interface FloorRange {
  fromFloor: number;
  toFloor: number;
  apartmentsPerFloor: number;
  area: number;
  rooms: number;
}

// Per-apartment config
interface ApartmentConfig {
  number?: string;  // manual apartment number; auto-generated if omitted
  area: number;
  rooms: number;
}

// Per-floor config — supports both simple (same for all) and detailed (per-apartment)
interface FloorConfig {
  floor: number;
  // Simple mode: same config for every apt on this floor
  apartmentsPerFloor?: number;
  area?: number;
  rooms?: number;
  // Detailed mode: individual config per apartment
  apartments?: ApartmentConfig[];
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

function generatePaymentCode(): string {
  return Math.floor(Math.random() * 900000000000 + 100000000000).toString();
}

// Generate apartments from floor ranges (legacy)
function generateFromRanges(blockId: number, floorRanges: FloorRange[]) {
  const apartments: {
    blockId: number; number: string; floor: number; rooms: number; area: string; status: "available"; paymentCode: string;
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
          paymentCode: generatePaymentCode(),
        });
      }
    }
  }
  return apartments;
}

// Generate apartments from per-floor config (supports both simple and per-apartment modes)
function generateFromFloorConfig(blockId: number, floorConfig: FloorConfig[]) {
  const apartments: {
    blockId: number; number: string; floor: number; rooms: number; area: string; status: "available"; paymentCode: string;
  }[] = [];

  for (const fc of floorConfig) {
    if (fc.apartments && fc.apartments.length > 0) {
      // Detailed mode: each apartment has its own area, rooms, and optional manual number
      fc.apartments.forEach((apt, i) => {
        apartments.push({
          blockId,
          number: apt.number?.trim()
            ? apt.number.trim()
            : `${fc.floor}${String(i + 1).padStart(2, "0")}`,
          floor: fc.floor,
          rooms: apt.rooms,
          area: String(apt.area),
          status: "available",
          paymentCode: generatePaymentCode(),
        });
      });
    } else if (fc.apartmentsPerFloor && fc.apartmentsPerFloor > 0) {
      // Simple mode: same config for all apts on floor
      for (let i = 1; i <= fc.apartmentsPerFloor; i++) {
        apartments.push({
          blockId,
          number: `${fc.floor}${String(i).padStart(2, "0")}`,
          floor: fc.floor,
          rooms: fc.rooms ?? 2,
          area: String(fc.area ?? 80),
          status: "available",
          paymentCode: generatePaymentCode(),
        });
      }
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

// ─── Block Reconfigure: add/remove/edit floors & apartments ──────────────────
// PUT /api/admin/blocks/:id/reconfigure
// Body: { username, password, floorConfig: [{floor, apartments: [{id?, number, area, rooms}]}] }
router.put("/blocks/:id/reconfigure", async (req, res) => {
  const { username, password, floorConfig } = req.body as {
    username: string;
    password: string;
    floorConfig: Array<{ floor: number; apartments: Array<{ id?: number; number: string; area: number; rooms: number }> }>;
  };

  if (!(await verifyAdmin(username, password, res))) return;

  const blockId = Number(req.params.id);
  const [block] = await db.select().from(blocksTable).where(eq(blocksTable.id, blockId)).limit(1);
  if (!block) return res.status(404).json({ error: "Blok tapılmadı" });

  // Get all existing apartments for this block
  const existing = await db.select().from(apartmentsTable).where(eq(apartmentsTable.blockId, blockId));
  const existingIds = new Set(existing.map((a) => a.id));

  // Collect all incoming IDs (existing apartments that should remain)
  const incomingIds = new Set<number>();
  for (const floor of floorConfig) {
    for (const apt of floor.apartments) {
      if (apt.id) incomingIds.add(apt.id);
    }
  }

  // Delete apartments that are no longer in the config (only if available — don't delete sold/reserved)
  const toDelete = existing.filter(
    (a) => !incomingIds.has(a.id) && (a.status === "available")
  );
  if (toDelete.length > 0) {
    await db.delete(apartmentsTable).where(
      inArray(apartmentsTable.id, toDelete.map((a) => a.id))
    );
  }

  // Upsert apartments from config
  for (const floor of floorConfig) {
    for (const apt of floor.apartments) {
      if (apt.id && existingIds.has(apt.id)) {
        // Update existing apartment
        await db.update(apartmentsTable).set({
          number: apt.number,
          area: String(apt.area),
          rooms: apt.rooms,
          floor: floor.floor,
        }).where(eq(apartmentsTable.id, apt.id));
      } else {
        // Create new apartment
        await db.insert(apartmentsTable).values({
          blockId,
          number: apt.number || `${floor.floor}xx`,
          floor: floor.floor,
          area: String(apt.area),
          rooms: apt.rooms,
          status: "available",
          paymentCode: generatePaymentCode(),
        });
      }
    }
  }

  // Recalculate block's floor count based on highest floor in config
  const maxFloor = floorConfig.reduce((m, f) => Math.max(m, f.floor), 0);
  await db.update(blocksTable).set({ floors: maxFloor }).where(eq(blocksTable.id, blockId));

  // Return summary
  const updatedApts = await db.select().from(apartmentsTable).where(eq(apartmentsTable.blockId, blockId));
  res.json({ blockId, floorCount: maxFloor, apartmentCount: updatedApts.length });
});

// POST /admin/verify — verifies admin password (used for cross-building garage authorization)
router.post("/verify", async (req, res) => {
  const { username, password } = req.body ?? {};
  const ok = await verifyAdmin(username, password, res);
  if (ok) res.json({ ok: true });
});

export default router;
