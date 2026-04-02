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
  rentalsTable,
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
  let blockName = "";

  if (bill.assetType === "apartment") {
    const [row] = await db
      .select({ apt: apartmentsTable, blockName: blocksTable.name })
      .from(apartmentsTable)
      .leftJoin(blocksTable, eq(apartmentsTable.blockId, blocksTable.id))
      .where(eq(apartmentsTable.id, bill.assetId));
    if (row) {
      assetDescription = `${row.blockName} - Mənzil ${row.apt.number}`;
      blockName = row.blockName ?? "";
    }
  } else {
    const [obj] = await db.select().from(objectsTable).where(eq(objectsTable.id, bill.assetId));
    if (obj) {
      assetDescription = `${obj.type === "garage" ? "Qaraj" : "Obyekt"} ${obj.number}`;
    }
  }

  if (bill.ownerCustomerId) {
    const [cust] = await db.select().from(customersTable).where(eq(customersTable.id, bill.ownerCustomerId));
    if (cust) ownerName = `${cust.firstName} ${cust.lastName}`;
  }

  const area = Number(bill.area);
  const isGarageRent = bill.assetType === "garage" && area === 0;

  return {
    id: bill.id,
    assetType: bill.assetType,
    assetId: bill.assetId,
    assetDescription,
    ownerName,
    blockName,
    month: bill.month,
    year: bill.year,
    area,
    tariff: Number(bill.tariff),
    amount: Number(bill.amount),
    status: bill.status,
    paidDate: bill.paidDate?.toISOString() ?? null,
    isGarageRent,
  };
}

// GET /api/communal?month=&year=&status=&assetType=
router.get("/", async (req, res) => {
  const { month, year, status, assetType } = req.query;
  let query = db.select().from(communalBillsTable).$dynamic();

  const conditions: ReturnType<typeof eq>[] = [];
  if (month) conditions.push(eq(communalBillsTable.month, Number(month)));
  if (year) conditions.push(eq(communalBillsTable.year, Number(year)));
  if (status) conditions.push(eq(communalBillsTable.status, status as string));
  if (assetType) conditions.push(eq(communalBillsTable.assetType, assetType as string));

  if (conditions.length) {
    const { and } = await import("drizzle-orm");
    query = query.where(and(...conditions));
  }

  const bills = await query.orderBy(communalBillsTable.year, communalBillsTable.month, communalBillsTable.assetType, communalBillsTable.assetId);
  res.json(await Promise.all(bills.map(enrichBill)));
});

// GET /api/communal/summary?month=&year= — summary breakdown
router.get("/summary", async (req, res) => {
  const { month, year } = req.query;
  const conditions: ReturnType<typeof eq>[] = [];
  if (month) conditions.push(eq(communalBillsTable.month, Number(month)));
  if (year) conditions.push(eq(communalBillsTable.year, Number(year)));

  const bills = await db.select().from(communalBillsTable).where(conditions.length ? and(...conditions) : undefined);

  const apartmentBills = bills.filter(b => b.assetType === "apartment");
  const garageBills = bills.filter(b => b.assetType === "garage");
  const objectBills = bills.filter(b => b.assetType === "object");

  const sumPaid = (arr: typeof bills) => arr.filter(b => b.status === "paid").reduce((s, b) => s + Number(b.amount), 0);
  const sumPending = (arr: typeof bills) => arr.filter(b => b.status === "pending").reduce((s, b) => s + Number(b.amount), 0);

  res.json({
    apartment: {
      total: apartmentBills.length,
      paid: apartmentBills.filter(b => b.status === "paid").length,
      pending: apartmentBills.filter(b => b.status === "pending").length,
      paidAmount: Math.round(sumPaid(apartmentBills) * 100) / 100,
      pendingAmount: Math.round(sumPending(apartmentBills) * 100) / 100,
    },
    garage: {
      total: garageBills.length,
      paid: garageBills.filter(b => b.status === "paid").length,
      pending: garageBills.filter(b => b.status === "pending").length,
      paidAmount: Math.round(sumPaid(garageBills) * 100) / 100,
      pendingAmount: Math.round(sumPending(garageBills) * 100) / 100,
    },
    object: {
      total: objectBills.length,
      paid: objectBills.filter(b => b.status === "paid").length,
      pending: objectBills.filter(b => b.status === "pending").length,
      paidAmount: Math.round(sumPaid(objectBills) * 100) / 100,
      pendingAmount: Math.round(sumPending(objectBills) * 100) / 100,
    },
    overall: {
      total: bills.length,
      paid: bills.filter(b => b.status === "paid").length,
      pending: bills.filter(b => b.status === "pending").length,
      paidAmount: Math.round(sumPaid(bills) * 100) / 100,
      pendingAmount: Math.round(sumPending(bills) * 100) / 100,
    },
  });
});

// POST /api/communal — generate monthly bills
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

  // 1. Handed-over sold apartments → communal based on area × tariff
  const soldApartments = await db
    .select({ apt: apartmentsTable })
    .from(apartmentsTable)
    .where(and(eq(apartmentsTable.status, "sold"), eq(apartmentsTable.handedOver, true)));

  for (const { apt } of soldApartments) {
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

  // 2. Sold commercial objects (NOT garages) → communal based on area × tariff
  const soldObjects = await db
    .select()
    .from(objectsTable)
    .where(and(eq(objectsTable.type, "object"), eq(objectsTable.status, "sold")));

  for (const obj of soldObjects) {
    const [sale] = await db
      .select()
      .from(salesTable)
      .where(and(eq(salesTable.assetType, "object"), eq(salesTable.assetId, obj.id)));

    const area = Number(obj.area);
    bills.push({
      assetType: "object",
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

  // 3. Active garage rentals → garage rent bill (fixed monthly amount, not area-based)
  const activeGarageRentals = await db
    .select()
    .from(rentalsTable)
    .where(and(eq(rentalsTable.assetType, "garage"), eq(rentalsTable.status, "active")));

  for (const rental of activeGarageRentals) {
    const monthlyAmount = Number(rental.monthlyAmount);
    bills.push({
      assetType: "garage",
      assetId: rental.assetId,
      ownerCustomerId: rental.customerId ?? null,
      month,
      year,
      area: "0",
      tariff: String(monthlyAmount),
      amount: String(monthlyAmount),
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

router.post("/:id/unpay", async (req, res) => {
  const [updated] = await db
    .update(communalBillsTable)
    .set({ status: "pending", paidDate: null })
    .where(eq(communalBillsTable.id, Number(req.params.id)))
    .returning();

  if (!updated) return res.status(404).json({ error: "Not found" });
  res.json(await enrichBill(updated));
});

export default router;
