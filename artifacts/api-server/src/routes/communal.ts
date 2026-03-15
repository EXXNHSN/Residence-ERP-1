import { Router } from "express";
import { db } from "@workspace/db";
import {
  communalBillsTable,
  apartmentsTable,
  objectsTable,
  blocksTable,
  customersTable,
  salesTable,
  tariffsTable,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router = Router();

async function getCommunalTariff(): Promise<number> {
  const tariff = await db.select().from(tariffsTable).where(eq(tariffsTable.key, "communal_tariff"));
  return tariff.length ? Number(tariff[0].value) : 0.5;
}

async function enrichBill(bill: typeof communalBillsTable.$inferSelect) {
  let assetDescription = `#${bill.assetId}`;
  let ownerName = "";

  if (bill.assetType === "apartment") {
    const [row] = await db
      .select({ apt: apartmentsTable, blockName: blocksTable.name })
      .from(apartmentsTable)
      .leftJoin(blocksTable, eq(apartmentsTable.blockId, blocksTable.id))
      .where(eq(apartmentsTable.id, bill.assetId));
    if (row) assetDescription = `${row.blockName} - Mənzil ${row.apt.number}`;
  } else {
    const [obj] = await db.select().from(objectsTable).where(eq(objectsTable.id, bill.assetId));
    if (obj) assetDescription = `${obj.type === "garage" ? "Qaraj" : "Obyekt"} ${obj.number}`;
  }

  if (bill.ownerCustomerId) {
    const [cust] = await db.select().from(customersTable).where(eq(customersTable.id, bill.ownerCustomerId));
    if (cust) ownerName = `${cust.firstName} ${cust.lastName}`;
  }

  return {
    id: bill.id,
    assetType: bill.assetType,
    assetId: bill.assetId,
    assetDescription,
    ownerName,
    month: bill.month,
    year: bill.year,
    area: Number(bill.area),
    tariff: Number(bill.tariff),
    amount: Number(bill.amount),
    status: bill.status,
    paidDate: bill.paidDate?.toISOString() ?? null,
  };
}

router.get("/", async (req, res) => {
  const { month, year, status } = req.query;
  let query = db.select().from(communalBillsTable).$dynamic();

  const conditions: ReturnType<typeof eq>[] = [];
  if (month) conditions.push(eq(communalBillsTable.month, Number(month)));
  if (year) conditions.push(eq(communalBillsTable.year, Number(year)));
  if (status) conditions.push(eq(communalBillsTable.status, status as string));

  if (conditions.length) {
    const { and } = await import("drizzle-orm");
    query = query.where(and(...conditions));
  }

  const bills = await query.orderBy(communalBillsTable.year, communalBillsTable.month, communalBillsTable.assetId);
  res.json(await Promise.all(bills.map(enrichBill)));
});

router.post("/", async (req, res) => {
  const { month, year } = req.body;
  const tariff = await getCommunalTariff();

  // Check if already generated
  const existing = await db
    .select()
    .from(communalBillsTable)
    .where(and(eq(communalBillsTable.month, month), eq(communalBillsTable.year, year)));

  if (existing.length > 0) {
    return res.status(400).json({ error: "Bills already generated for this month/year" });
  }

  const bills: typeof communalBillsTable.$inferInsert[] = [];

  // Get sold apartments
  const soldApartments = await db
    .select({ apt: apartmentsTable })
    .from(apartmentsTable)
    .where(eq(apartmentsTable.status, "sold"));

  for (const { apt } of soldApartments) {
    // Find owner
    const [sale] = await db
      .select()
      .from(salesTable)
      .where(and(eq(salesTable.assetType, "apartment"), eq(salesTable.assetId, apt.id)));

    const area = Number(apt.area);
    bills.push({
      assetType: "apartment",
      assetId: apt.id,
      ownerCustomerId: sale?.customerId ?? null,
      month,
      year,
      area: String(area),
      tariff: String(tariff),
      amount: String(Math.round(area * tariff * 100) / 100),
      status: "pending",
    });
  }

  // Get sold and rented objects/garages
  const occupiedObjects = await db
    .select()
    .from(objectsTable)
    .where(and(
      eq(objectsTable.status, "sold")
    ));

  for (const obj of occupiedObjects) {
    const [sale] = await db
      .select()
      .from(salesTable)
      .where(and(eq(salesTable.assetType, obj.type), eq(salesTable.assetId, obj.id)));

    const area = Number(obj.area);
    bills.push({
      assetType: obj.type as "object" | "garage",
      assetId: obj.id,
      ownerCustomerId: sale?.customerId ?? null,
      month,
      year,
      area: String(area),
      tariff: String(tariff),
      amount: String(Math.round(area * tariff * 100) / 100),
      status: "pending",
    });
  }

  if (bills.length === 0) {
    return res.status(201).json({ count: 0, bills: [] });
  }

  const inserted = await db.insert(communalBillsTable).values(bills).returning();
  const enriched = await Promise.all(inserted.map(enrichBill));
  res.status(201).json({ count: enriched.length, bills: enriched });
});

router.post("/:id/pay", async (req, res) => {
  const [updated] = await db
    .update(communalBillsTable)
    .set({ status: "paid", paidDate: new Date() })
    .where(eq(communalBillsTable.id, Number(req.params.id)))
    .returning();

  if (!updated) return res.status(404).json({ error: "Not found" });
  res.json(await enrichBill(updated));
});

export default router;
