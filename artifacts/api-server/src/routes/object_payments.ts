import { Router } from "express";
import { db } from "@workspace/db";
import { objectPaymentsTable, rentalsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { verifyAdmin } from "./adminVerify";

const router = Router();

// Get payments for a rental
router.get("/rental/:rentalId", async (req, res) => {
  const payments = await db
    .select()
    .from(objectPaymentsTable)
    .where(eq(objectPaymentsTable.rentalId, Number(req.params.rentalId)))
    .orderBy(objectPaymentsTable.period);
  res.json(payments);
});

// Mark a payment as paid
router.put("/:id/pay", async (req, res) => {
  const { paymentDate, note } = req.body ?? {};
  const [updated] = await db
    .update(objectPaymentsTable)
    .set({
      status: "paid",
      paymentDate: paymentDate || new Date().toISOString().split("T")[0],
      note: note || null,
    })
    .where(eq(objectPaymentsTable.id, Number(req.params.id)))
    .returning();
  if (!updated) return res.status(404).json({ error: "Tapılmadı" });
  res.json(updated);
});

// Mark a payment as pending (undo pay)
router.put("/:id/unpay", async (req, res) => {
  const [updated] = await db
    .update(objectPaymentsTable)
    .set({ status: "pending", paymentDate: null, note: null })
    .where(eq(objectPaymentsTable.id, Number(req.params.id)))
    .returning();
  if (!updated) return res.status(404).json({ error: "Tapılmadı" });
  res.json(updated);
});

// Update payment amount (admin only)
router.put("/:id", async (req, res) => {
  const { username, password, amount, note } = req.body ?? {};
  if (!(await verifyAdmin(username, password, res))) return;
  const updates: any = {};
  if (amount !== undefined) updates.amount = String(amount);
  if (note !== undefined) updates.note = note || null;
  const [updated] = await db
    .update(objectPaymentsTable)
    .set(updates)
    .where(eq(objectPaymentsTable.id, Number(req.params.id)))
    .returning();
  if (!updated) return res.status(404).json({ error: "Tapılmadı" });
  res.json(updated);
});

export default router;
