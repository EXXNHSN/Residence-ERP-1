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
import { eq, and, ne, desc } from "drizzle-orm";
import { verifyAdmin } from "./adminVerify";

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
      assetDescription = `${row.blockName ?? ""} - Mənzil ${row.apt.number}`;
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
  const tariff = Number(bill.tariff);
  const customTariff = bill.customTariff != null ? Number(bill.customTariff) : null;
  const amount = Number(bill.amount);
  const carryOver = bill.carryOver != null ? Number(bill.carryOver) : 0;
  const totalAmount = bill.totalAmount != null ? Number(bill.totalAmount) : (amount + carryOver);

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
    tariff,
    customTariff,
    amount,
    carryOver,
    totalAmount,
    status: bill.status,
    paidDate: bill.paidDate?.toISOString() ?? null,
    isGarageRent,
  };
}

// Əvvəlki aylardan yığılmış ödənilməmiş borc
async function getCarryOverForAsset(assetType: string, assetId: number, month: number, year: number): Promise<number> {
  const priorBills = await db.select().from(communalBillsTable)
    .where(and(
      eq(communalBillsTable.assetType, assetType as any),
      eq(communalBillsTable.assetId, assetId)
    ));

  const strictlyPrior = priorBills.filter(b => b.year < year || (b.year === year && b.month < month));
  if (strictlyPrior.length === 0) return 0;

  strictlyPrior.sort((a, b) => (b.year * 100 + b.month) - (a.year * 100 + a.month));
  const latestPrior = strictlyPrior[0];

  if (latestPrior.status !== "paid") {
    return Number(latestPrior.totalAmount || latestPrior.amount);
  }
  return 0;
}

// Əvvəlki ayda mənzil üçün xüsusi güzəştli tarif varsa onu gətir
async function getPreviousCustomTariff(assetType: string, assetId: number, month: number, year: number): Promise<number | null> {
  const priorBills = await db.select().from(communalBillsTable)
    .where(and(
      eq(communalBillsTable.assetType, assetType as any),
      eq(communalBillsTable.assetId, assetId)
    ));

  const strictlyPrior = priorBills.filter(b => b.year < year || (b.year === year && b.month < month));
  if (strictlyPrior.length === 0) return null;

  strictlyPrior.sort((a, b) => (b.year * 100 + b.month) - (a.year * 100 + a.month));
  const latestPrior = strictlyPrior[0];

  return latestPrior.customTariff != null ? Number(latestPrior.customTariff) : null;
}

// GET /api/communal?month=&year=&status=&assetType=
router.get("/", async (req, res) => {
  const { month, year, status, assetType } = req.query;
  let query = db.select().from(communalBillsTable).$dynamic();

  const conditions: ReturnType<typeof eq>[] = [];
  if (month) conditions.push(eq(communalBillsTable.month, Number(month)));
  if (year) conditions.push(eq(communalBillsTable.year, Number(year)));
  if (status) conditions.push(eq(communalBillsTable.status, status as any));
  if (assetType) conditions.push(eq(communalBillsTable.assetType, assetType as any));

  if (conditions.length) {
    query = query.where(and(...conditions));
  }

  const bills = await query.orderBy(
    desc(communalBillsTable.year),
    desc(communalBillsTable.month),
    desc(communalBillsTable.id)
  );
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

  const sumPaid = (arr: typeof bills) => arr.filter(b => b.status === "paid").reduce((s, b) => s + Number(b.totalAmount || b.amount), 0);
  const sumPending = (arr: typeof bills) => arr.filter(b => b.status !== "paid").reduce((s, b) => s + Number(b.totalAmount || b.amount), 0);

  res.json({
    apartment: {
      total: apartmentBills.length,
      paid: apartmentBills.filter(b => b.status === "paid").length,
      pending: apartmentBills.filter(b => b.status !== "paid").length,
      paidAmount: Math.round(sumPaid(apartmentBills) * 100) / 100,
      pendingAmount: Math.round(sumPending(apartmentBills) * 100) / 100,
    },
    garage: {
      total: garageBills.length,
      paid: garageBills.filter(b => b.status === "paid").length,
      pending: garageBills.filter(b => b.status !== "paid").length,
      paidAmount: Math.round(sumPaid(garageBills) * 100) / 100,
      pendingAmount: Math.round(sumPending(garageBills) * 100) / 100,
    },
    object: {
      total: objectBills.length,
      paid: objectBills.filter(b => b.status === "paid").length,
      pending: objectBills.filter(b => b.status !== "paid").length,
      paidAmount: Math.round(sumPaid(objectBills) * 100) / 100,
      pendingAmount: Math.round(sumPending(objectBills) * 100) / 100,
    },
    overall: {
      total: bills.length,
      paid: bills.filter(b => b.status === "paid").length,
      pending: bills.filter(b => b.status !== "paid").length,
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
    return res.status(400).json({ error: "Bu ay/il üçün hesablar artıq yaradılıb" });
  }

  const bills: typeof communalBillsTable.$inferInsert[] = [];

  // 1. Handed-over sold apartments → communal based on area × tariff + carry-over
  const soldApartments = await db
    .select({ apt: apartmentsTable })
    .from(apartmentsTable)
    .where(and(eq(apartmentsTable.status, "sold" as const), eq(apartmentsTable.handedOver, true)));

  for (const { apt } of soldApartments) {
    const [sale] = await db
      .select()
      .from(salesTable)
      .where(and(eq(salesTable.assetType, "apartment" as const), eq(salesTable.assetId, apt.id)));

    const prevCustomTariff = await getPreviousCustomTariff("apartment", apt.id, month, year);
    const effectiveTariff = prevCustomTariff ?? tariff;

    const area = Number(apt.area);
    const amount = Math.round(area * effectiveTariff * 100) / 100;
    const carryOver = await getCarryOverForAsset("apartment", apt.id, month, year);
    const totalAmount = Math.round((amount + carryOver) * 100) / 100;

    bills.push({
      assetType: "apartment",
      assetId: apt.id,
      ownerCustomerId: sale?.customerId ?? null,
      month,
      year,
      area: String(area),
      tariff: String(tariff),
      customTariff: prevCustomTariff ? String(prevCustomTariff) : null,
      amount: String(amount),
      carryOver: String(carryOver),
      totalAmount: String(totalAmount),
      status: "pending",
    });
  }

  // 2. Sold commercial objects (NOT garages) → communal based on area × tariff
  const soldObjects = await db
    .select()
    .from(objectsTable)
    .where(and(eq(objectsTable.type, "object" as const), eq(objectsTable.status, "sold" as const)));

  for (const obj of soldObjects) {
    const [sale] = await db
      .select()
      .from(salesTable)
      .where(and(eq(salesTable.assetType, "object" as const), eq(salesTable.assetId, obj.id)));

    const area = Number(obj.area);
    const amount = Math.round(area * tariff * 100) / 100;
    const carryOver = await getCarryOverForAsset("object", obj.id, month, year);
    const totalAmount = Math.round((amount + carryOver) * 100) / 100;

    bills.push({
      assetType: "object",
      assetId: obj.id,
      ownerCustomerId: sale?.customerId ?? null,
      month,
      year,
      area: String(area),
      tariff: String(tariff),
      amount: String(amount),
      carryOver: String(carryOver),
      totalAmount: String(totalAmount),
      status: "pending",
    });
  }

  // 3. Active garage rentals → garage rent bill (fixed monthly amount, not area-based)
  const activeGarageRentals = await db
    .select()
    .from(rentalsTable)
    .where(and(eq(rentalsTable.assetType, "garage" as const), eq(rentalsTable.status, "active" as const)));

  for (const rental of activeGarageRentals) {
    const monthlyAmount = Number(rental.monthlyAmount);
    const carryOver = await getCarryOverForAsset("garage", rental.assetId, month, year);
    const totalAmount = Math.round((monthlyAmount + carryOver) * 100) / 100;

    bills.push({
      assetType: "garage",
      assetId: rental.assetId,
      ownerCustomerId: rental.customerId ?? null,
      month,
      year,
      area: "0",
      tariff: String(monthlyAmount),
      amount: String(monthlyAmount),
      carryOver: String(carryOver),
      totalAmount: String(totalAmount),
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

// POST /api/communal/:id/pay — ödəniş et və əvvəlki ödənilməmiş borcları da bağla
router.post("/:id/pay", async (req, res) => {
  const [bill] = await db.select().from(communalBillsTable).where(eq(communalBillsTable.id, Number(req.params.id)));
  if (!bill) return res.status(404).json({ error: "Hesab tapılmadı" });

  const now = new Date();
  const [updated] = await db
    .update(communalBillsTable)
    .set({ status: "paid", paidDate: now })
    .where(eq(communalBillsTable.id, bill.id))
    .returning();

  // Əgər carryOver var idisə, bu aktivin əvvəlki bütün ödənilməmiş qeydlərini də ödənilmiş et
  if (Number(bill.carryOver) > 0) {
    const priorBills = await db.select().from(communalBillsTable)
      .where(and(
        eq(communalBillsTable.assetType, bill.assetType),
        eq(communalBillsTable.assetId, bill.assetId),
        ne(communalBillsTable.status, "paid")
      ));

    for (const pb of priorBills) {
      if (pb.year < bill.year || (pb.year === bill.year && pb.month < bill.month)) {
        await db.update(communalBillsTable).set({ status: "paid", paidDate: now }).where(eq(communalBillsTable.id, pb.id));
      }
    }
  }

  res.json(await enrichBill(updated));
});

// POST /api/communal/:id/unpay — ödənişi ləğv et
router.post("/:id/unpay", async (req, res) => {
  const [updated] = await db
    .update(communalBillsTable)
    .set({ status: "pending", paidDate: null })
    .where(eq(communalBillsTable.id, Number(req.params.id)))
    .returning();

  if (!updated) return res.status(404).json({ error: "Hesab tapılmadı" });
  res.json(await enrichBill(updated));
});

// PATCH /api/communal/:id/tariff — Administrator tərəfindən mənzil üçün fərdi güzəştli tarifin dəyişdirilməsi
router.patch("/:id/tariff", async (req, res) => {
  const { username, password, customTariff } = req.body;
  if (!(await verifyAdmin(username, password, res))) return;

  const [bill] = await db.select().from(communalBillsTable)
    .where(eq(communalBillsTable.id, Number(req.params.id)));

  if (!bill) return res.status(404).json({ error: "Hesab tapılmadı" });

  const area = Number(bill.area);
  const newTariff = customTariff ? Number(customTariff) : Number(bill.tariff);
  const newAmount = Math.round(area * newTariff * 100) / 100;
  const carryOver = Number(bill.carryOver || 0);
  const newTotalAmount = Math.round((newAmount + carryOver) * 100) / 100;

  const [updated] = await db
    .update(communalBillsTable)
    .set({
      customTariff: customTariff ? String(newTariff) : null,
      amount: String(newAmount),
      totalAmount: String(newTotalAmount),
    })
    .where(eq(communalBillsTable.id, Number(req.params.id)))
    .returning();

  res.json(await enrichBill(updated));
});

export default router;
