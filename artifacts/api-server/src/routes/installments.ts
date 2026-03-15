import { Router } from "express";
import { db } from "@workspace/db";
import { installmentsTable } from "@workspace/db/schema";
import { salesTable } from "@workspace/db/schema";
import { customersTable } from "@workspace/db/schema";
import { eq, and, lte } from "drizzle-orm";

const router = Router();

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
  res.json(
    installments.map((inst) => ({
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
    }))
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

  const sale = await db
    .select({ customerId: salesTable.customerId })
    .from(salesTable)
    .where(eq(salesTable.id, updated.saleId))
    .limit(1);

  let customerName = "—";
  if (sale[0]) {
    const customer = await db
      .select({ firstName: customersTable.firstName, lastName: customersTable.lastName })
      .from(customersTable)
      .where(eq(customersTable.id, sale[0].customerId))
      .limit(1);
    if (customer[0]) {
      customerName = `${customer[0].firstName} ${customer[0].lastName}`;
    }
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
  });
});

export default router;
