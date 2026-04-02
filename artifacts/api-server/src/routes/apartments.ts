import { Router } from "express";
import { db } from "@workspace/db";
import { apartmentsTable, blocksTable, tariffsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { verifyAdmin } from "./adminVerify";

const router = Router();

async function getApartmentPricePerSqm(): Promise<number> {
  const tariff = await db.select().from(tariffsTable).where(eq(tariffsTable.key, "apartment_price_per_sqm"));
  return tariff.length ? Number(tariff[0].value) : 1000;
}

function generatePaymentCode(): string {
  return Math.floor(Math.random() * 900000000000 + 100000000000).toString();
}

async function enrichApartment(apt: typeof apartmentsTable.$inferSelect, blockName: string, pricePerSqm: number) {
  const area = Number(apt.area);
  return {
    id: apt.id,
    blockId: apt.blockId,
    blockName,
    number: apt.number,
    floor: apt.floor,
    rooms: apt.rooms,
    area,
    status: apt.status,
    handedOver: apt.handedOver,
    paymentCode: apt.paymentCode ?? null,
    pricePerSqm,
    totalPrice: area * pricePerSqm,
  };
}

router.get("/", async (req, res) => {
  const { blockId, status } = req.query;
  const conditions: ReturnType<typeof eq>[] = [];

  if (blockId) conditions.push(eq(apartmentsTable.blockId, Number(blockId)));
  if (status) conditions.push(eq(apartmentsTable.status, status as string));

  const apts = await db
    .select({ apt: apartmentsTable, blockName: blocksTable.name })
    .from(apartmentsTable)
    .leftJoin(blocksTable, eq(apartmentsTable.blockId, blocksTable.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(apartmentsTable.blockId, apartmentsTable.number);

  const pricePerSqm = await getApartmentPricePerSqm();
  res.json(await Promise.all(apts.map((r) => enrichApartment(r.apt, r.blockName ?? "", pricePerSqm))));
});

router.post("/", async (req, res) => {
  const { blockId, number, floor, rooms, area } = req.body;
  const [apt] = await db
    .insert(apartmentsTable)
    .values({ blockId, number, floor, rooms: rooms ?? 1, area: String(area), paymentCode: generatePaymentCode() })
    .returning();
  const block = await db.select().from(blocksTable).where(eq(blocksTable.id, blockId)).limit(1);
  const pricePerSqm = await getApartmentPricePerSqm();
  res.status(201).json(await enrichApartment(apt, block[0]?.name ?? "", pricePerSqm));
});

router.get("/:id", async (req, res) => {
  const [row] = await db
    .select({ apt: apartmentsTable, blockName: blocksTable.name })
    .from(apartmentsTable)
    .leftJoin(blocksTable, eq(apartmentsTable.blockId, blocksTable.id))
    .where(eq(apartmentsTable.id, Number(req.params.id)));

  if (!row) return res.status(404).json({ error: "Not found" });
  const pricePerSqm = await getApartmentPricePerSqm();
  res.json(await enrichApartment(row.apt, row.blockName ?? "", pricePerSqm));
});

router.patch("/:id", async (req, res) => {
  const { area, rooms, number, floor, status } = req.body;
  const updates: Partial<typeof apartmentsTable.$inferInsert> = {};
  if (area !== undefined) updates.area = String(area);
  if (rooms !== undefined) updates.rooms = Number(rooms);
  if (number !== undefined) updates.number = String(number);
  if (floor !== undefined) updates.floor = Number(floor);
  if (status !== undefined) updates.status = status;

  const [updated] = await db
    .update(apartmentsTable)
    .set(updates)
    .where(eq(apartmentsTable.id, Number(req.params.id)))
    .returning();

  if (!updated) return res.status(404).json({ error: "Not found" });
  const block = await db.select().from(blocksTable).where(eq(blocksTable.id, updated.blockId)).limit(1);
  const pricePerSqm = await getApartmentPricePerSqm();
  res.json(await enrichApartment(updated, block[0]?.name ?? "", pricePerSqm));
});

// Admin-only edit with password verification
router.put("/:id", async (req, res) => {
  const { username, password, number, floor, rooms, area } = req.body ?? {};
  if (!(await verifyAdmin(username, password, res))) return;

  const updates: Partial<typeof apartmentsTable.$inferInsert> = {};
  if (number !== undefined && String(number).trim()) updates.number = String(number).trim();
  if (floor !== undefined && !isNaN(Number(floor))) updates.floor = Number(floor);
  if (rooms !== undefined && !isNaN(Number(rooms)) && Number(rooms) >= 1) updates.rooms = Number(rooms);
  if (area !== undefined && !isNaN(Number(area)) && Number(area) > 0) updates.area = String(Number(area));

  if (Object.keys(updates).length === 0)
    return res.status(400).json({ error: "Heç bir dəyişiklik yoxdur" });

  const [updated] = await db
    .update(apartmentsTable)
    .set(updates)
    .where(eq(apartmentsTable.id, Number(req.params.id)))
    .returning();

  if (!updated) return res.status(404).json({ error: "Tapılmadı" });
  const block = await db.select().from(blocksTable).where(eq(blocksTable.id, updated.blockId)).limit(1);
  const pricePerSqm = await getApartmentPricePerSqm();
  res.json(await enrichApartment(updated, block[0]?.name ?? "", pricePerSqm));
});

router.patch("/:id/handover", async (req, res) => {
  const { handedOver } = req.body;
  const [updated] = await db
    .update(apartmentsTable)
    .set({ handedOver: Boolean(handedOver) })
    .where(eq(apartmentsTable.id, Number(req.params.id)))
    .returning();
  if (!updated) return res.status(404).json({ error: "Tapılmadı" });
  const block = await db.select().from(blocksTable).where(eq(blocksTable.id, updated.blockId)).limit(1);
  const pricePerSqm = await getApartmentPricePerSqm();
  res.json(await enrichApartment(updated, block[0]?.name ?? "", pricePerSqm));
});

router.delete("/:id", async (req, res) => {
  await db.delete(apartmentsTable).where(eq(apartmentsTable.id, Number(req.params.id)));
  res.status(204).send();
});

export default router;
