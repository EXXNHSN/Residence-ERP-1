import { Router } from "express";
import { db } from "@workspace/db";
import { installmentsTable, salesTable, customersTable, apartmentsTable, objectsTable, blocksTable } from "@workspace/db/schema";
import { eq, and, lte, or } from "drizzle-orm";

const router = Router();

async function getAssetDescription(assetType: string, assetId: number): Promise<string> {
  if (assetType === "apartment") {
    const [row] = await db
      .select({ number: apartmentsTable.number, blockName: blocksTable.name })
      .from(apartmentsTable)
      .leftJoin(blocksTable, eq(apartmentsTable.blockId, blocksTable.id))
      .where(eq(apartmentsTable.id, assetId));
    if (row) return `${row.blockName} - Mənzil ${row.number}`;
  } else {
    const [obj] = await db.select().from(objectsTable).where(eq(objectsTable.id, assetId));
    if (obj) return `${obj.type === "garage" ? "Qaraj" : "Obyekt"} ${obj.number}`;
  }
  return `#${assetId}`;
}

router.get("/", async (req, res) => {
  const { saleId, status, overdue } = req.query;

  // Mark past-due pending/partial installments as overdue
  await db
    .update(installmentsTable)
    .set({ status: "overdue" })
    .where(
      and(
        or(eq(installmentsTable.status, "pending"), eq(installmentsTable.status, "partial")),
        lte(installmentsTable.dueDate, new Date())
      )
    );

  let query = db
    .select({
      id: installmentsTable.id,
      saleId: installmentsTable.saleId,
      installmentNumber: installmentsTable.installmentNumber,
      amount: installmentsTable.amount,
      paidAmount: installmentsTable.paidAmount,
      dueDate: installmentsTable.dueDate,
      paidDate: installmentsTable.paidDate,
      status: installmentsTable.status,
      createdAt: installmentsTable.createdAt,
      customerFirstName: customersTable.firstName,
      customerLastName: customersTable.lastName,
      saleAssetType: salesTable.assetType,
      saleAssetId: salesTable.assetId,
      saleMonthlyPayment: salesTable.monthlyPayment,
    })
    .from(installmentsTable)
    .leftJoin(salesTable, eq(installmentsTable.saleId, salesTable.id))
    .leftJoin(customersTable, eq(salesTable.customerId, customersTable.id))
    .$dynamic();

  const conditions: ReturnType<typeof eq>[] = [];
  if (saleId) conditions.push(eq(installmentsTable.saleId, Number(saleId)));
  if (status) conditions.push(eq(installmentsTable.status, status as string));
  if (overdue === "true") conditions.push(eq(installmentsTable.status, "overdue"));

  if (conditions.length) {
    const { and } = await import("drizzle-orm");
    query = query.where(and(...conditions));
  }

  const installments = await query.orderBy(installmentsTable.dueDate);

  const assetDescriptions: Record<string, string> = {};
  for (const inst of installments) {
    const key = `${inst.saleAssetType}-${inst.saleAssetId}`;
    if (!assetDescriptions[key] && inst.saleAssetType && inst.saleAssetId) {
      assetDescriptions[key] = await getAssetDescription(inst.saleAssetType, inst.saleAssetId);
    }
  }

  res.json(
    installments.map((inst) => {
      const assetKey = `${inst.saleAssetType}-${inst.saleAssetId}`;
      const amount = Number(inst.amount);
      const paidAmt = Number(inst.paidAmount ?? 0);
      return {
        id: inst.id,
        saleId: inst.saleId,
        installmentNumber: inst.installmentNumber,
        amount,
        paidAmount: paidAmt,
        remainingAmount: Math.max(0, amount - paidAmt),
        dueDate: inst.dueDate.toISOString(),
        paidDate: inst.paidDate?.toISOString() ?? null,
        status: inst.status,
        customerName: inst.customerFirstName && inst.customerLastName
          ? `${inst.customerFirstName} ${inst.customerLastName}`
          : "—",
        assetDescription: assetDescriptions[assetKey] ?? "—",
        monthlyPayment: Number(inst.saleMonthlyPayment ?? 0),
      };
    })
  );
});

// Bulk payment — distributes payment amount across pending/partial installments in order
router.post("/bulk-pay", async (req, res) => {
  const { saleId, paymentAmount, paymentDate } = req.body;
  if (!saleId || !paymentAmount || paymentAmount <= 0) {
    return res.status(400).json({ error: "saleId və paymentAmount tələb olunur" });
  }

  const paidAt = paymentDate ? new Date(paymentDate) : new Date();
  let remaining = Number(paymentAmount);

  // Get all unpaid/partial installments for this sale, ordered by due date
  const pending = await db
    .select()
    .from(installmentsTable)
    .where(
      and(
        eq(installmentsTable.saleId, Number(saleId)),
        or(
          eq(installmentsTable.status, "pending"),
          eq(installmentsTable.status, "overdue"),
          eq(installmentsTable.status, "partial")
        )
      )
    )
    .orderBy(installmentsTable.dueDate);

  const updatedIds: number[] = [];

  for (const inst of pending) {
    if (remaining <= 0) break;

    const instAmount = Number(inst.amount);
    const alreadyPaid = Number(inst.paidAmount ?? 0);
    const needsToPay = instAmount - alreadyPaid;

    if (needsToPay <= 0) continue;

    const toApply = Math.min(remaining, needsToPay);
    const newPaidAmount = alreadyPaid + toApply;
    remaining = Math.round((remaining - toApply) * 100) / 100;

    const isFullyPaid = newPaidAmount >= instAmount - 0.01;
    const newStatus = isFullyPaid ? "paid" : "partial";

    await db
      .update(installmentsTable)
      .set({
        paidAmount: String(Math.round(newPaidAmount * 100) / 100),
        status: newStatus,
        paidDate: isFullyPaid ? paidAt : inst.paidDate,
      })
      .where(eq(installmentsTable.id, inst.id));

    updatedIds.push(inst.id);
  }

  // Return all installments for this sale (refreshed)
  const [saleRow] = await db
    .select({ assetType: salesTable.assetType, assetId: salesTable.assetId, customerId: salesTable.customerId, monthlyPayment: salesTable.monthlyPayment })
    .from(salesTable).where(eq(salesTable.id, Number(saleId))).limit(1);

  let customerName = "—";
  let assetDescription = "—";
  let monthlyPayment = 0;

  if (saleRow) {
    monthlyPayment = Number(saleRow.monthlyPayment);
    assetDescription = await getAssetDescription(saleRow.assetType, saleRow.assetId);
    const [cust] = await db.select().from(customersTable).where(eq(customersTable.id, saleRow.customerId)).limit(1);
    if (cust) customerName = `${cust.firstName} ${cust.lastName}`;
  }

  const allInstallments = await db
    .select()
    .from(installmentsTable)
    .where(eq(installmentsTable.saleId, Number(saleId)))
    .orderBy(installmentsTable.dueDate);

  res.json({
    appliedAmount: Number(paymentAmount) - remaining,
    remainingBalance: remaining,
    updatedCount: updatedIds.length,
    installments: allInstallments.map(inst => {
      const amount = Number(inst.amount);
      const paidAmt = Number(inst.paidAmount ?? 0);
      return {
        id: inst.id,
        saleId: inst.saleId,
        installmentNumber: inst.installmentNumber,
        amount,
        paidAmount: paidAmt,
        remainingAmount: Math.max(0, amount - paidAmt),
        dueDate: inst.dueDate.toISOString(),
        paidDate: inst.paidDate?.toISOString() ?? null,
        status: inst.status,
        customerName,
        assetDescription,
        monthlyPayment,
      };
    }),
  });
});

// Single installment pay (legacy, kept for compatibility)
router.post("/:id/pay", async (req, res) => {
  const { paidDate } = req.body;
  const [updated] = await db
    .update(installmentsTable)
    .set({
      status: "paid",
      paidDate: new Date(paidDate),
      paidAmount: installmentsTable.amount,
    })
    .where(eq(installmentsTable.id, Number(req.params.id)))
    .returning();

  if (!updated) return res.status(404).json({ error: "Not found" });

  const [saleRow] = await db
    .select({ customerId: salesTable.customerId, assetType: salesTable.assetType, assetId: salesTable.assetId, monthlyPayment: salesTable.monthlyPayment })
    .from(salesTable)
    .where(eq(salesTable.id, updated.saleId))
    .limit(1);

  let customerName = "—";
  let assetDescription = "—";
  let monthlyPayment = 0;

  if (saleRow) {
    monthlyPayment = Number(saleRow.monthlyPayment);
    assetDescription = await getAssetDescription(saleRow.assetType, saleRow.assetId);
    const [cust] = await db.select().from(customersTable).where(eq(customersTable.id, saleRow.customerId)).limit(1);
    if (cust) customerName = `${cust.firstName} ${cust.lastName}`;
  }

  const amount = Number(updated.amount);
  res.json({
    id: updated.id,
    saleId: updated.saleId,
    installmentNumber: updated.installmentNumber,
    amount,
    paidAmount: amount,
    remainingAmount: 0,
    dueDate: updated.dueDate.toISOString(),
    paidDate: updated.paidDate?.toISOString() ?? null,
    status: updated.status,
    customerName,
    assetDescription,
    monthlyPayment,
  });
});

export default router;
