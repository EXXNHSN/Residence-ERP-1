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

  // Auto-update overdue installments
  await db
    .update(installmentsTable)
    .set({ status: "overdue" })
    .where(and(eq(installmentsTable.status, "pending"), lte(installmentsTable.dueDate, now)));

  const allApts = await db.select().from(apartmentsTable);
  const totalApartments = allApts.length;
  const soldApartments = allApts.filter((a) => a.status === "sold").length;
  const availableApartments = allApts.filter((a) => a.status === "available").length;
  const reservedApartments = allApts.filter((a) => a.status === "reserved").length;

  const allObjs = await db.select().from(objectsTable);
  const totalObjects = allObjs.filter((o) => o.type === "object").length;
  const availableObjects = allObjs.filter((o) => o.type === "object" && o.status === "available").length;
  const totalGarages = allObjs.filter((o) => o.type === "garage").length;
  const availableGarages = allObjs.filter((o) => o.type === "garage" && o.status === "available").length;

  const allSales = await db.select().from(salesTable);
  const totalSales = allSales.length;
  const cashSales = allSales.filter((s) => s.saleType === "cash").length;
  const creditSales = allSales.filter((s) => s.saleType === "credit").length;

  const allInstallments = await db.select().from(installmentsTable);
  const pendingInstallments = allInstallments.filter((i) => i.status === "pending").length;
  const overdueInstallments = allInstallments.filter((i) => i.status === "overdue").length;

  // Faktiki daxil olan gəlir:
  // - Nağd satışlar: tam məbləğ (dərhal alınıb)
  // - Kredit satışlar: ilkin ödəniş + ödənilmiş taksitlər
  const paidInstallmentsBySale: Record<number, number> = {};
  for (const inst of allInstallments.filter((i) => i.status === "paid")) {
    paidInstallmentsBySale[inst.saleId] = (paidInstallmentsBySale[inst.saleId] ?? 0) + Number(inst.amount);
  }
  const totalRevenue = allSales.reduce((sum, s) => {
    if (s.saleType === "cash") return sum + Number(s.totalAmount);
    return sum + Number(s.downPayment) + (paidInstallmentsBySale[s.id] ?? 0);
  }, 0);
  const paidThisMonth = allInstallments
    .filter(
      (i) =>
        i.status === "paid" &&
        i.paidDate &&
        new Date(i.paidDate).getMonth() === now.getMonth() &&
        new Date(i.paidDate).getFullYear() === now.getFullYear()
    )
    .reduce((sum, i) => sum + Number(i.amount), 0);

  // Bu ayın gözlənilən ödənişləri (hələ ödənilməyənlər)
  const monthlyPendingAmount = allInstallments
    .filter(
      (i) =>
        (i.status === "pending" || i.status === "overdue") &&
        new Date(i.dueDate).getMonth() === now.getMonth() &&
        new Date(i.dueDate).getFullYear() === now.getFullYear()
    )
    .reduce((sum, i) => sum + Number(i.amount), 0);

  const allRentals = await db.select().from(rentalsTable);
  const activeRentals = allRentals.filter((r) => r.status === "active").length;

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
    totalObjects,
    availableObjects,
    totalGarages,
    availableGarages,
    totalSales,
    cashSales,
    creditSales,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    pendingInstallments,
    overdueInstallments,
    activeRentals,
    pendingCommunalBills,
    activeInternetSubscriptions,
    totalCustomers: customerCount.count,
    monthlyInstallmentIncome: Math.round(paidThisMonth * 100) / 100,
    monthlyPendingAmount: Math.round(monthlyPendingAmount * 100) / 100,
    monthlyCommunalIncome: Math.round(paidCommunalThisMonth * 100) / 100,
  });
});

export default router;
