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
} from "@workspace/db/schema";
import { eq, and, lte, count } from "drizzle-orm";

const router = Router();

router.get("/summary", async (_req, res) => {
  const now = new Date();

  await db
    .update(installmentsTable)
    .set({ status: "overdue" })
    .where(and(eq(installmentsTable.status, "pending"), lte(installmentsTable.dueDate, now)));

  // ── Apartments ──
  const allApts = await db.select().from(apartmentsTable);
  const totalApartments = allApts.length;
  const soldApartments = allApts.filter((a) => a.status === "sold").length;
  const availableApartments = allApts.filter((a) => a.status === "available").length;
  const reservedApartments = allApts.filter((a) => a.status === "reserved").length;
  const handedOverApartments = allApts.filter((a) => a.handedOver === true).length;

  // ── Objects & Garages ──
  const allObjs = await db.select().from(objectsTable);
  const totalObjects = allObjs.filter((o) => o.type === "object").length;
  const availableObjects = allObjs.filter((o) => o.type === "object" && o.status === "available").length;
  const soldObjects = allObjs.filter((o) => o.type === "object" && o.status === "sold").length;
  const rentedObjects = allObjs.filter((o) => o.type === "object" && o.status === "rented").length;

  const totalGarages = allObjs.filter((o) => o.type === "garage").length;
  const availableGarages = allObjs.filter((o) => o.type === "garage" && o.status === "available").length;
  const soldGarages = allObjs.filter((o) => o.type === "garage" && o.status === "sold").length;
  const rentedGarages = allObjs.filter((o) => o.type === "garage" && o.status === "rented").length;

  // ── Sales Revenue ──
  const allSales = await db.select().from(salesTable);
  const totalSales = allSales.length;
  const cashSales = allSales.filter((s) => s.saleType === "cash").length;
  const creditSales = allSales.filter((s) => s.saleType === "credit").length;

  const cashSalesRevenue = allSales
    .filter((s) => s.saleType === "cash" && s.assetType === "apartment")
    .reduce((sum, s) => sum + Number(s.totalAmount), 0);

  const downPaymentRevenue = allSales
    .filter((s) => s.saleType === "credit" && s.assetType === "apartment")
    .reduce((sum, s) => sum + Number(s.downPayment ?? 0), 0);

  // Garage sale revenue (from all garage sales)
  const garageSaleRevenue = allSales
    .filter((s) => s.assetType === "garage")
    .reduce((sum, s) => sum + Number(s.totalAmount ?? 0), 0);

  // Object sale revenue
  const objectSaleRevenue = allSales
    .filter((s) => s.assetType === "object")
    .reduce((sum, s) => sum + Number(s.totalAmount ?? 0), 0);

  // ── Installments ──
  const allInstallments = await db.select().from(installmentsTable);
  const pendingInstallments = allInstallments.filter((i) => i.status === "pending").length;
  const overdueInstallments = allInstallments.filter((i) => i.status === "overdue").length;

  const creditInstallmentIncome = allInstallments
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + Number(i.amount), 0);

  const totalRevenue = cashSalesRevenue + downPaymentRevenue + creditInstallmentIncome;

  const paidThisMonth = allInstallments
    .filter(
      (i) =>
        i.status === "paid" &&
        i.paidDate &&
        new Date(i.paidDate).getMonth() === now.getMonth() &&
        new Date(i.paidDate).getFullYear() === now.getFullYear()
    )
    .reduce((sum, i) => sum + Number(i.amount), 0);

  const monthlyPendingAmount = allInstallments
    .filter(
      (i) =>
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
      .filter((i) => {
        const due = new Date(i.dueDate);
        return due.getMonth() === m && due.getFullYear() === y;
      })
      .reduce((sum, i) => sum + Number(i.amount), 0);
    installmentProjections.push({ month: m + 1, year: y, expected: Math.round(expected * 100) / 100 });
  }

  // ── Rentals ──
  const allRentals = await db.select().from(rentalsTable);
  const activeRentals = allRentals.filter((r) => r.status === "active").length;
  
  // Object rentals (non-garage)
  const activeObjectRentals = allRentals.filter((r) => r.status === "active" && r.assetType === "object");
  const monthlyObjectRentalIncome = activeObjectRentals.reduce((sum, r) => sum + Number(r.monthlyAmount), 0);
  
  // Garage rentals
  const activeGarageRentals = allRentals.filter((r) => r.status === "active" && r.assetType === "garage");
  const monthlyGarageRentalIncome = activeGarageRentals.reduce((sum, r) => sum + Number(r.monthlyAmount), 0);
  
  const monthlyRentalIncome = monthlyObjectRentalIncome + monthlyGarageRentalIncome;

  // ── Communal Bills ──
  const allCommunal = await db.select().from(communalBillsTable);
  const pendingCommunalBills = allCommunal.filter((b) => b.status === "pending").length;

  const paidCommunalThisMonth = allCommunal
    .filter(
      (b) =>
        b.status === "paid" &&
        b.paidDate &&
        new Date(b.paidDate).getMonth() === now.getMonth() &&
        new Date(b.paidDate).getFullYear() === now.getFullYear()
    )
    .reduce((sum, b) => sum + Number(b.amount), 0);

  // Breakdown: apartment communal vs garage rent (in communal)
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

  // ── Internet ──
  const allInternet = await db.select().from(internetSubscriptionsTable);
  const activeInternetSubscriptions = allInternet.filter((i) => i.status === "active").length;

  const [customerCount] = await db.select({ count: count() }).from(customersTable);

  res.json({
    // Apartments
    totalApartments,
    soldApartments,
    availableApartments,
    reservedApartments,
    handedOverApartments,
    // Objects
    totalObjects,
    availableObjects,
    soldObjects,
    rentedObjects,
    // Garages
    totalGarages,
    availableGarages,
    soldGarages,
    rentedGarages,
    // Sales
    totalSales,
    cashSales,
    creditSales,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    cashSalesRevenue: Math.round(cashSalesRevenue * 100) / 100,
    downPaymentRevenue: Math.round(downPaymentRevenue * 100) / 100,
    creditInstallmentIncome: Math.round(creditInstallmentIncome * 100) / 100,
    garageSaleRevenue: Math.round(garageSaleRevenue * 100) / 100,
    objectSaleRevenue: Math.round(objectSaleRevenue * 100) / 100,
    // Installments
    pendingInstallments,
    overdueInstallments,
    monthlyInstallmentIncome: Math.round(paidThisMonth * 100) / 100,
    monthlyPendingAmount: Math.round(monthlyPendingAmount * 100) / 100,
    installmentProjections,
    // Rentals
    activeRentals,
    monthlyRentalIncome: Math.round(monthlyRentalIncome * 100) / 100,
    monthlyObjectRentalIncome: Math.round(monthlyObjectRentalIncome * 100) / 100,
    monthlyGarageRentalIncome: Math.round(monthlyGarageRentalIncome * 100) / 100,
    // Communal
    pendingCommunalBills,
    monthlyCommunalIncome: Math.round(paidCommunalThisMonth * 100) / 100,
    monthlyApartmentCommunalIncome: Math.round(paidApartmentCommunalThisMonth * 100) / 100,
    monthlyGarageRentBillsIncome: Math.round(paidGarageRentBillsThisMonth * 100) / 100,
    // Internet & Customers
    activeInternetSubscriptions,
    totalCustomers: customerCount.count,
  });
});

export default router;
