import { Router } from "express";
import { db } from "@workspace/db";
import { installmentsTable, salesTable, customersTable, apartmentsTable, objectsTable, blocksTable } from "@workspace/db/schema";
import { eq, and, lte } from "drizzle-orm";

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

  await db
    .update(installmentsTable)
    .set({ status: "overdue" })
    .where(
      and(
        eq(installmentsTable.status, "pending"),
        lte(installmentsTable.dueDate, new Date())
      )
    );

  let query = db
    .select({
      id: installmentsTable.id,
      saleId: installmentsTable.saleId,
      installmentNumber: installmentsTable.installmentNumber,
      amount: installmentsTable.amount,
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

  // Build asset descriptions for unique sales
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
      return {
        id: inst.id,
        saleId: inst.saleId,
        installmentNumber: inst.installmentNumber,
        amount: Number(inst.amount),
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

router.post("/:id/pay", async (req, res) => {
  const { paidDate } = req.body;
  const [updated] = await db
    .update(installmentsTable)
    .set({ status: "paid", paidDate: new Date(paidDate) })
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

  res.json({
    id: updated.id,
    saleId: updated.saleId,
    installmentNumber: updated.installmentNumber,
    amount: Number(updated.amount),
    dueDate: updated.dueDate.toISOString(),
    paidDate: updated.paidDate?.toISOString() ?? null,
    status: updated.status,
    customerName,
    assetDescription,
    monthlyPayment,
  });
});

export default router;
