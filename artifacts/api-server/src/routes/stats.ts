import { Router } from "express";
import { db } from "@workspace/db";
import {
  apartmentsTable,
  objectsTable,
  salesTable,
  installmentsTable,
  rentalsTable,
  communalBillsTable,
  internetSubscriptionsTable,
  customersTable,
  blocksTable,
  quartersTable,
} from "@workspace/db/schema";
import { eq, and, lte, count, inArray } from "drizzle-orm";

const router = Router();

router.get("/summary", async (req, res) => {
  const now = new Date();
  const quarterId = req.query.quarterId ? Number(req.query.quarterId) : null;

  await db
    .update(installmentsTable)
    .set({ status: "overdue" })
    .where(and(eq(installmentsTable.status, "pending"), lte(installmentsTable.dueDate, now)));

  // ── Kvartal filtering ──
  // Get block IDs in selected quarter (blocks.quarterId = quarterId)
  let blockIdsInQuarter: number[] | null = null;
  if (quarterId) {
    const blocks = await db.select({ id: blocksTable.id })
      .from(blocksTable)
      .where(eq(blocksTable.quarterId, quarterId));
    blockIdsInQuarter = blocks.map(b => b.id);
  }

  // ── Apartments ──
  const allAptsRaw = await db.select().from(apartmentsTable);
  const allApts = blockIdsInQuarter
    ? allAptsRaw.filter(a => a.blockId !== null && blockIdsInQuarter!.includes(a.blockId))
    : allAptsRaw;

  const totalApartments = allApts.length;
  const soldApartments = allApts.filter(a => a.status === "sold").length;
  const availableApartments = allApts.filter(a => a.status === "available").length;
  const reservedApartments = allApts.filter(a => a.status === "reserved").length;
  const handedOverApartments = allApts.filter(a => a.handedOver === true).length;
  const aptIds = allApts.map(a => a.id);

  // ── Objects & Garages ──
  const allObjsRaw = await db.select().from(objectsTable);
  const allObjs = blockIdsInQuarter
    ? allObjsRaw.filter(o => o.blockId !== null && blockIdsInQuarter!.includes(o.blockId))
    : allObjsRaw;

  const totalObjects = allObjs.filter(o => o.type === "object").length;
  const availableObjects = allObjs.filter(o => o.type === "object" && o.status === "available").length;
  const soldObjects = allObjs.filter(o => o.type === "object" && o.status === "sold").length;
  const rentedObjects = allObjs.filter(o => o.type === "object" && o.status === "rented").length;

  const totalGarages = allObjs.filter(o => o.type === "garage").length;
  const availableGarages = allObjs.filter(o => o.type === "garage" && o.status === "available").length;
  const soldGarages = allObjs.filter(o => o.type === "garage" && o.status === "sold").length;
  const rentedGarages = allObjs.filter(o => o.type === "garage" && o.status === "rented").length;

  const objIds = allObjs.map(o => o.id);
  const garageIds = new Set(allObjs.filter(o => o.type === "garage").map(o => o.id));

  // ── Sales Revenue ──
  const allSalesRaw = await db.select().from(salesTable);
  const allSales = blockIdsInQuarter
    ? allSalesRaw.filter(s => {
        if (s.assetType === "apartment") return aptIds.includes(s.assetId);
        return objIds.includes(s.assetId);
      })
    : allSalesRaw;

  const totalSales = allSales.length;
  const aptCashSales   = allSales.filter(s => s.saleType === "cash"   && s.assetType === "apartment").length;
  const aptCreditSales = allSales.filter(s => s.saleType === "credit" && s.assetType === "apartment").length;
  const cashSales      = allSales.filter(s => s.saleType === "cash").length;
  const creditSales    = allSales.filter(s => s.saleType === "credit").length;

  // Per-type sale counts
  const objectCashSales   = allSales.filter(s => s.saleType === "cash"   && s.assetType === "object").length;
  const objectCreditSales = allSales.filter(s => s.saleType === "credit" && s.assetType === "object").length;
  const garageCashSales   = allSales.filter(s => s.saleType === "cash"   && s.assetType === "garage").length;
  const garageCreditSales = allSales.filter(s => s.saleType === "credit" && s.assetType === "garage").length;

  // Revenue calculations
  const cashSalesRevenue = allSales
    .filter(s => s.saleType === "cash" && s.assetType === "apartment")
    .reduce((sum, s) => sum + Number(s.totalAmount), 0);
  const downPaymentRevenue = allSales
    .filter(s => s.saleType === "credit" && s.assetType === "apartment")
    .reduce((sum, s) => sum + Number(s.downPayment ?? 0), 0);
  const garageSaleRevenue = allSales
    .filter(s => s.assetType === "garage")
    .reduce((sum, s) => sum + Number(s.totalAmount ?? 0), 0);
  const objectSaleRevenue = allSales
    .filter(s => s.assetType === "object")
    .reduce((sum, s) => sum + Number(s.totalAmount ?? 0), 0);

  // ── Installments ──
  const allInstallmentsRaw = await db
    .select({
      id: installmentsTable.id,
      amount: installmentsTable.amount,
      status: installmentsTable.status,
      dueDate: installmentsTable.dueDate,
      paidDate: installmentsTable.paidDate,
      assetType: salesTable.assetType,
      saleId: installmentsTable.saleId,
    })
    .from(installmentsTable)
    .innerJoin(salesTable, eq(installmentsTable.saleId, salesTable.id));

  const saleIds = new Set(allSales.map(s => s.id));
  const allInstallmentsWithType = blockIdsInQuarter
    ? allInstallmentsRaw.filter(i => saleIds.has(i.saleId))
    : allInstallmentsRaw;

  const allInstallmentsRawFlat = await db.select().from(installmentsTable);
  const allInstallments = blockIdsInQuarter
    ? allInstallmentsRawFlat.filter(i => saleIds.has(i.saleId))
    : allInstallmentsRawFlat;

  const pendingInstallments = allInstallments.filter(i => i.status === "pending").length;
  const overdueInstallments = allInstallments.filter(i => i.status === "overdue").length;

  const creditInstallmentIncome = allInstallmentsWithType
    .filter(i => i.status === "paid" && i.assetType === "apartment")
    .reduce((sum, i) => sum + Number(i.amount), 0);
  const garageInstallmentIncome = allInstallmentsWithType
    .filter(i => i.status === "paid" && i.assetType === "garage")
    .reduce((sum, i) => sum + Number(i.amount), 0);
  const objectInstallmentIncome = allInstallmentsWithType
    .filter(i => i.status === "paid" && i.assetType === "object")
    .reduce((sum, i) => sum + Number(i.amount), 0);

  const aptTotalReceived = cashSalesRevenue + downPaymentRevenue + creditInstallmentIncome;
  const garageTotalReceived = allSales
    .filter(s => s.saleType === "cash" && s.assetType === "garage")
    .reduce((sum, s) => sum + Number(s.totalAmount), 0)
    + allSales.filter(s => s.saleType === "credit" && s.assetType === "garage")
      .reduce((sum, s) => sum + Number(s.downPayment ?? 0), 0)
    + garageInstallmentIncome;
  const objectTotalReceived = allSales
    .filter(s => s.saleType === "cash" && s.assetType === "object")
    .reduce((sum, s) => sum + Number(s.totalAmount), 0)
    + allSales.filter(s => s.saleType === "credit" && s.assetType === "object")
      .reduce((sum, s) => sum + Number(s.downPayment ?? 0), 0)
    + objectInstallmentIncome;
  const grandTotalReceived = aptTotalReceived + garageTotalReceived + objectTotalReceived;

  const paidThisMonth = allInstallments
    .filter(i =>
      i.status === "paid" && i.paidDate &&
      new Date(i.paidDate).getMonth() === now.getMonth() &&
      new Date(i.paidDate).getFullYear() === now.getFullYear()
    )
    .reduce((sum, i) => sum + Number(i.amount), 0);

  const monthlyPendingAmount = allInstallments
    .filter(i =>
      (i.status === "pending" || i.status === "overdue") &&
      new Date(i.dueDate).getMonth() === now.getMonth() &&
      new Date(i.dueDate).getFullYear() === now.getFullYear()
    )
    .reduce((sum, i) => sum + Number(i.amount), 0);

  const installmentProjections: { month: number; year: number; expected: number }[] = [];
  for (let offset = 1; offset <= 3; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const m = d.getMonth();
    const y = d.getFullYear();
    const expected = allInstallments
      .filter(i => { const due = new Date(i.dueDate); return due.getMonth() === m && due.getFullYear() === y; })
      .reduce((sum, i) => sum + Number(i.amount), 0);
    installmentProjections.push({ month: m + 1, year: y, expected: Math.round(expected * 100) / 100 });
  }

  // ── Rentals ──
  const allRentalsRaw = await db.select().from(rentalsTable);
  const allRentals = blockIdsInQuarter
    ? allRentalsRaw.filter(r => objIds.includes(r.assetId))
    : allRentalsRaw;

  const activeRentals = allRentals.filter(r => r.status === "active").length;
  const isGarageRental = (r: typeof allRentals[0]) =>
    r.assetType === "garage" || (r.assetType === "object" && garageIds.has(r.assetId));
  const activeObjectRentals = allRentals.filter(r => r.status === "active" && !isGarageRental(r));
  const monthlyObjectRentalIncome = activeObjectRentals.reduce((sum, r) => sum + Number(r.monthlyAmount), 0);
  const activeGarageRentals = allRentals.filter(r => r.status === "active" && isGarageRental(r));
  const monthlyGarageRentalIncome = activeGarageRentals.reduce((sum, r) => sum + Number(r.monthlyAmount), 0);
  const monthlyRentalIncome = monthlyObjectRentalIncome + monthlyGarageRentalIncome;

  // ── Communal Bills ──
  const allCommunalRaw = await db.select().from(communalBillsTable);
  const allCommunal = blockIdsInQuarter
    ? allCommunalRaw.filter(b => {
        if (b.assetType === "apartment") return aptIds.includes(b.assetId);
        return objIds.includes(b.assetId);
      })
    : allCommunalRaw;

  const pendingCommunalBills = allCommunal.filter(b => b.status === "pending").length;

  const paidCommunalThisMonth = allCommunal
    .filter(b =>
      b.status === "paid" && b.paidDate &&
      new Date(b.paidDate).getMonth() === now.getMonth() &&
      new Date(b.paidDate).getFullYear() === now.getFullYear()
    )
    .reduce((sum, b) => sum + Number(b.amount), 0);

  const paidApartmentCommunalThisMonth = allCommunal
    .filter(b => b.assetType === "apartment" && b.status === "paid" && b.paidDate &&
      new Date(b.paidDate).getMonth() === now.getMonth() &&
      new Date(b.paidDate).getFullYear() === now.getFullYear())
    .reduce((sum, b) => sum + Number(b.amount), 0);

  const paidGarageRentBillsThisMonth = allCommunal
    .filter(b => b.assetType === "garage" && b.status === "paid" && b.paidDate &&
      new Date(b.paidDate).getMonth() === now.getMonth() &&
      new Date(b.paidDate).getFullYear() === now.getFullYear())
    .reduce((sum, b) => sum + Number(b.amount), 0);

  // Total communal pending amount (for handedOver apartments)
  const totalPendingCommunalAmount = allCommunal
    .filter(b => b.status === "pending" && b.assetType === "apartment")
    .reduce((sum, b) => sum + Number(b.amount), 0);

  // ── Internet ──
  const allInternet = await db.select().from(internetSubscriptionsTable);
  const activeInternetSubscriptions = allInternet.filter(i => i.status === "active").length;

  // ── Customers ──
  const [customerCount] = await db.select({ count: count() }).from(customersTable);

  // ── Quarters list (for filtering UI) ──
  const quarters = await db.select().from(quartersTable).orderBy(quartersTable.name);

  res.json({
    // Apartments
    totalApartments, soldApartments, availableApartments, reservedApartments, handedOverApartments,
    // Objects
    totalObjects, availableObjects, soldObjects, rentedObjects,
    // Garages
    totalGarages, availableGarages, soldGarages, rentedGarages,
    // Sales — counts
    totalSales, cashSales, creditSales,
    aptCashSales, aptCreditSales,
    objectCashSales, objectCreditSales,
    garageCashSales, garageCreditSales,
    // Sales — revenue by type
    totalRevenue: Math.round(aptTotalReceived * 100) / 100,
    cashSalesRevenue: Math.round(cashSalesRevenue * 100) / 100,
    downPaymentRevenue: Math.round(downPaymentRevenue * 100) / 100,
    creditInstallmentIncome: Math.round(creditInstallmentIncome * 100) / 100,
    aptTotalReceived: Math.round(aptTotalReceived * 100) / 100,
    garageSaleRevenue: Math.round(garageSaleRevenue * 100) / 100,
    garageTotalReceived: Math.round(garageTotalReceived * 100) / 100,
    garageInstallmentIncome: Math.round(garageInstallmentIncome * 100) / 100,
    objectSaleRevenue: Math.round(objectSaleRevenue * 100) / 100,
    objectTotalReceived: Math.round(objectTotalReceived * 100) / 100,
    objectInstallmentIncome: Math.round(objectInstallmentIncome * 100) / 100,
    grandTotalReceived: Math.round(grandTotalReceived * 100) / 100,
    // Installments
    pendingInstallments, overdueInstallments,
    monthlyInstallmentIncome: Math.round(paidThisMonth * 100) / 100,
    monthlyPendingAmount: Math.round(monthlyPendingAmount * 100) / 100,
    installmentProjections,
    // Rentals
    activeRentals, monthlyRentalIncome: Math.round(monthlyRentalIncome * 100) / 100,
    monthlyObjectRentalIncome: Math.round(monthlyObjectRentalIncome * 100) / 100,
    monthlyGarageRentalIncome: Math.round(monthlyGarageRentalIncome * 100) / 100,
    // Communal
    pendingCommunalBills,
    totalPendingCommunalAmount: Math.round(totalPendingCommunalAmount * 100) / 100,
    monthlyCommunalIncome: Math.round(paidCommunalThisMonth * 100) / 100,
    monthlyApartmentCommunalIncome: Math.round(paidApartmentCommunalThisMonth * 100) / 100,
    monthlyGarageRentBillsIncome: Math.round(paidGarageRentBillsThisMonth * 100) / 100,
    // Internet & Customers
    activeInternetSubscriptions,
    totalCustomers: customerCount.count,
    // Quarters
    quarters,
  });
});

export default router;
