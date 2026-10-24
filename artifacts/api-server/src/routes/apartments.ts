import { Router } from "express";
import { db } from "@workspace/db";
import { apartmentsTable, blocksTable, tariffsTable, communalBillsTable, salesTable } from "@workspace/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { verifyAdmin } from "./adminVerify";

const router = Router();

async function getApartmentPricePerSqm(): Promise<number> {
  const tariff = await db.select().from(tariffsTable).where(eq(tariffsTable.key, "apartment_price_per_sqm"));
  return tariff.length ? Number(tariff[0].value) : 1000;
}

async function getCommunalTariff(): Promise<number> {
  const tariff = await db.select().from(tariffsTable).where(eq(tariffsTable.key, "communal_tariff"));
  return tariff.length ? Number(tariff[0].value) : 0.5;
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

// Tehvil toggle — satılmış mənzil təhvil edildikdə avtomatik kommunal bölməsinə hesab düşür
router.patch("/:id/handover", async (req, res) => {
  const { handedOver } = req.body;
  const newHandedOver = Boolean(handedOver);

  const [updated] = await db
    .update(apartmentsTable)
    .set({ handedOver: newHandedOver })
    .where(eq(apartmentsTable.id, Number(req.params.id)))
    .returning();

  if (!updated) return res.status(404).json({ error: "Tapılmadı" });

  // Tehvil true edildikdə və mənzil satılıbsa — cari ay üçün kommunal qeyd yarat (əgər yoxdursa)
  if (newHandedOver && updated.status === "sold") {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const existing = await db.select().from(communalBillsTable)
      .where(and(
        eq(communalBillsTable.assetType, "apartment" as const),
        eq(communalBillsTable.assetId, updated.id),
        eq(communalBillsTable.month, currentMonth),
        eq(communalBillsTable.year, currentYear)
      ));

    if (existing.length === 0) {
      const tariff = await getCommunalTariff();
      const area = Number(updated.area);
      const amount = Math.round(area * tariff * 100) / 100;

      const [sale] = await db.select().from(salesTable)
        .where(and(
          eq(salesTable.assetType, "apartment" as const),
          eq(salesTable.assetId, updated.id)
        ));

      // Əvvəlki aylardan yığılmış ödənilməmiş borc
      const priorBills = await db.select().from(communalBillsTable)
        .where(and(
          eq(communalBillsTable.assetType, "apartment" as const),
          eq(communalBillsTable.assetId, updated.id)
        ));
      const strictlyPrior = priorBills.filter(b => b.year < currentYear || (b.year === currentYear && b.month < currentMonth));
      let carryOver = 0;
      if (strictlyPrior.length > 0) {
        strictlyPrior.sort((a, b) => (b.year * 100 + b.month) - (a.year * 100 + a.month));
        if (strictlyPrior[0].status !== "paid") {
          carryOver = Number(strictlyPrior[0].totalAmount || strictlyPrior[0].amount);
        }
      }
      const totalAmount = Math.round((amount + carryOver) * 100) / 100;

      await db.insert(communalBillsTable).values({
        assetType: "apartment",
        assetId: updated.id,
        ownerCustomerId: sale?.customerId ?? null,
        month: currentMonth,
        year: currentYear,
        area: String(area),
        tariff: String(tariff),
        amount: String(amount),
        carryOver: String(carryOver),
        totalAmount: String(totalAmount),
        status: "pending",
      });
    }
  }

  const block = await db.select().from(blocksTable).where(eq(blocksTable.id, updated.blockId)).limit(1);
  const pricePerSqm = await getApartmentPricePerSqm();
  res.json(await enrichApartment(updated, block[0]?.name ?? "", pricePerSqm));
});

router.delete("/:id", async (req, res) => {
  await db.delete(apartmentsTable).where(eq(apartmentsTable.id, Number(req.params.id)));
  res.status(204).send();
});

export default router;
