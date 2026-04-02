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

  const allApts = await db.select().from(apartmentsTable);
  const totalApartments = allApts.length;
  const soldApartments = allApts.filter((a) => a.status === "sold").length;
  const availableApartments = allApts.filter((a) => a.status === "available").length;
  const reservedApartments = allApts.filter((a) => a.status === "reserved").length;
  const handedOverApartments = allApts.filter((a) => a.handedOver === true).length;

  const allObjs = await db.select().from(objectsTable);
  const totalObjects = allObjs.filter((o) => o.type === "object").length;
  const availableObjects = allObjs.filter((o) => o.type === "object" && o.status === "available").length;
  const rentedObjects = allObjs.filter((o) => o.status === "rented").length;
  const totalGarages = allObjs.filter((o) => o.type === "garage").length;
  const availableGarages = allObjs.filter((o) => o.type === "garage" && o.status === "available").length;

  const allSales = await db.select().from(salesTable);
  const totalSales = allSales.length;
  const cashSales = allSales.filter((s) => s.saleType === "cash").length;
  const creditSales = allSales.filter((s) => s.saleType === "credit").length;

  const cashSalesRevenue = allSales
    .filter((s) => s.saleType === "cash")
    .reduce((sum, s) => sum + Number(s.totalAmount), 0);

  const downPaymentRevenue = allSales
    .filter((s) => s.saleType === "credit")
    .reduce((sum, s) => sum + Number(s.downPayment ?? 0), 0);

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

  const allRentals = await db.select().from(rentalsTable);
  const activeRentals = allRentals.filter((r) => r.status === "active").length;
  const monthlyRentalIncome = allRentals
    .filter((r) => r.status === "active")
    .reduce((sum, r) => sum + Number(r.monthlyAmount), 0);

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

  const allInternet = await db.select().from(internetSubscriptionsTable);
  const activeInternetSubscriptions = allInternet.filter((i) => i.status === "active").length;

  const [customerCount] = await db.select({ count: count() }).from(customersTable);

  res.json({
    totalApartments,
    soldApartments,
    availableApartments,
    reservedApartments,
    handedOverApartments,
    totalObjects,
    availableObjects,
    rentedObjects,
    totalGarages,
    availableGarages,
    totalSales,
    cashSales,
    creditSales,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    cashSalesRevenue: Math.round(cashSalesRevenue * 100) / 100,
    downPaymentRevenue: Math.round(downPaymentRevenue * 100) / 100,
    creditInstallmentIncome: Math.round(creditInstallmentIncome * 100) / 100,
    monthlyRentalIncome: Math.round(monthlyRentalIncome * 100) / 100,
    pendingInstallments,
    overdueInstallments,
    activeRentals,
    pendingCommunalBills,
    activeInternetSubscriptions,
    totalCustomers: customerCount.count,
    monthlyInstallmentIncome: Math.round(paidThisMonth * 100) / 100,
    monthlyPendingAmount: Math.round(monthlyPendingAmount * 100) / 100,
    monthlyCommunalIncome: Math.round(paidCommunalThisMonth * 100) / 100,
    installmentProjections,
  });
});

export default router;
