import { Router } from "express";
import { db } from "@workspace/db";
import { installmentsTable } from "@workspace/db/schema";
import { eq, and, lte } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res) => {
  const { saleId, status, overdue } = req.query;

  // Auto-update overdue status
  await db
    .update(installmentsTable)
    .set({ status: "overdue" })
    .where(
      and(
        eq(installmentsTable.status, "pending"),
        lte(installmentsTable.dueDate, new Date())
      )
    );

  let query = db.select().from(installmentsTable).$dynamic();
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
      ...inst,
      amount: Number(inst.amount),
      dueDate: inst.dueDate.toISOString(),
      paidDate: inst.paidDate?.toISOString() ?? null,
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

  res.json({
    ...updated,
    amount: Number(updated.amount),
    dueDate: updated.dueDate.toISOString(),
    paidDate: updated.paidDate?.toISOString() ?? null,
  });
});

export default router;
