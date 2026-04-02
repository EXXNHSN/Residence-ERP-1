import { Router } from "express";
import { db } from "@workspace/db";
import { rentalsTable, customersTable, objectsTable, objectPaymentsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

async function enrichRental(rental: typeof rentalsTable.$inferSelect) {
  let customerName = rental.tenantName ?? "";
  if (!customerName && rental.customerId) {
    const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, rental.customerId));
    if (customer) customerName = `${customer.firstName} ${customer.lastName}`;
  }

  const [obj] = await db.select().from(objectsTable).where(eq(objectsTable.id, rental.assetId));

  const endDate = new Date(rental.endDate);
  const now = new Date();
  const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  const payments = await db.select().from(objectPaymentsTable).where(eq(objectPaymentsTable.rentalId, rental.id));
  const paidCount = payments.filter(p => p.status === "paid").length;
  const pendingCount = payments.filter(p => p.status === "pending").length;

  return {
    id: rental.id,
    assetType: rental.assetType,
    assetId: rental.assetId,
    assetDescription: obj ? `${obj.type === "garage" ? "Qaraj" : "Obyekt"} ${obj.number}` : `#${rental.assetId}`,
    customerId: rental.customerId,
    contractNumber: rental.contractNumber,
    tenantName: rental.tenantName ?? customerName,
    tenantPhone: rental.tenantPhone,
    tenantFin: rental.tenantFin,
    customerName,
    startDate: rental.startDate.toISOString(),
    endDate: rental.endDate.toISOString(),
    monthlyAmount: Number(rental.monthlyAmount),
    pricePerSqm: rental.pricePerSqm ? Number(rental.pricePerSqm) : null,
    status: rental.status,
    daysRemaining,
    paidCount,
    pendingCount,
    totalPayments: payments.length,
  };
}

router.get("/", async (req, res) => {
  const { status } = req.query;
  let query = db.select().from(rentalsTable).$dynamic();
  if (status) query = query.where(eq(rentalsTable.status, status as string));

  const rentals = await query.orderBy(rentalsTable.startDate);
  res.json(await Promise.all(rentals.map(enrichRental)));
});

router.get("/:id", async (req, res) => {
  const [rental] = await db.select().from(rentalsTable).where(eq(rentalsTable.id, Number(req.params.id))).limit(1);
  if (!rental) return res.status(404).json({ error: "Tapılmadı" });
  const payments = await db.select().from(objectPaymentsTable)
    .where(eq(objectPaymentsTable.rentalId, rental.id))
    .orderBy(objectPaymentsTable.period);
  const enriched = await enrichRental(rental);
  res.json({ ...enriched, payments });
});

router.post("/", async (req, res) => {
  const { assetType, assetId, customerId, contractNumber, tenantName, tenantPhone, tenantFin, startDate, endDate, monthlyAmount, pricePerSqm } = req.body;

  const [rental] = await db
    .insert(rentalsTable)
    .values({
      assetType,
      assetId,
      customerId: customerId ? Number(customerId) : null,
      contractNumber: contractNumber || null,
      tenantName: tenantName || null,
      tenantPhone: tenantPhone || null,
      tenantFin: tenantFin || null,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      monthlyAmount: String(monthlyAmount),
      pricePerSqm: pricePerSqm ? String(pricePerSqm) : null,
      status: "active",
    })
    .returning();

  // Update asset status to rented
  await db.update(objectsTable).set({ status: "rented" }).where(eq(objectsTable.id, assetId));

  // Auto-generate monthly payment records
  if (startDate && endDate && monthlyAmount) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const periods: { period: string; rentalId: number; amount: string; status: "pending" }[] = [];
    const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cur <= end) {
      const period = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`;
      periods.push({ period, rentalId: rental.id, amount: String(monthlyAmount), status: "pending" });
      cur.setMonth(cur.getMonth() + 1);
    }
    if (periods.length > 0) {
      await db.insert(objectPaymentsTable).values(periods);
    }
  }

  res.status(201).json(await enrichRental(rental));
});

router.put("/:id", async (req, res) => {
  const { status, endDate, contractNumber, tenantName, tenantPhone, tenantFin } = req.body;
  const updates: Partial<typeof rentalsTable.$inferInsert> = {};
  if (status) updates.status = status;
  if (endDate) updates.endDate = new Date(endDate);
  if (contractNumber !== undefined) updates.contractNumber = contractNumber || null;
  if (tenantName !== undefined) updates.tenantName = tenantName || null;
  if (tenantPhone !== undefined) updates.tenantPhone = tenantPhone || null;
  if (tenantFin !== undefined) updates.tenantFin = tenantFin || null;

  const [updated] = await db
    .update(rentalsTable)
    .set(updates)
    .where(eq(rentalsTable.id, Number(req.params.id)))
    .returning();

  if (!updated) return res.status(404).json({ error: "Tapılmadı" });

  if (status === "ended") {
    await db.update(objectsTable).set({ status: "available" }).where(eq(objectsTable.id, updated.assetId));
  }

  res.json(await enrichRental(updated));
});

export default router;
