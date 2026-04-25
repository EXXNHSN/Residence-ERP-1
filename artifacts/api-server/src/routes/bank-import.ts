import { Router } from "express";
import { db } from "@workspace/db";
import {
  salesTable, customersTable, installmentsTable,
  apartmentsTable, objectsTable,
} from "@workspace/db/schema";
import { eq, and, or } from "drizzle-orm";

const router = Router();

// Helper — get asset description for display
async function getAssetDescription(assetType: string, assetId: number): Promise<string> {
  if (assetType === "apartment") {
    const [apt] = await db.select().from(apartmentsTable).where(eq(apartmentsTable.id, assetId)).limit(1);
    return apt ? `Mənzil №${apt.number}` : `#${assetId}`;
  } else if (assetType === "object") {
    const [obj] = await db.select().from(objectsTable).where(eq(objectsTable.id, assetId)).limit(1);
    return obj ? obj.name : `#${assetId}`;
  }
  return `#${assetId}`;
}

// Calculate current outstanding balance for a sale
async function getOutstanding(saleId: number, totalAmount: number, downPayment: number, saleType: string): Promise<number> {
  if (saleType === "cash") return 0;
  const installments = await db
    .select()
    .from(installmentsTable)
    .where(eq(installmentsTable.saleId, saleId));
  const paidAmount = installments.reduce((sum, i) => sum + Number(i.paidAmount ?? 0), 0);
  const totalPaid = downPayment + paidAmount;
  return Math.max(0, totalAmount - totalPaid);
}

// ── PREVIEW ────────────────────────────────────────────────────────────────────
// Input: { rows: [{ qaimeNumber: string, amount: number, paymentDate?: string, rowNumber?: number }] }
// Returns matched/unmatched analysis without applying anything
router.post("/preview", async (req, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  if (rows.length === 0) {
    return res.status(400).json({ error: "Heç bir sətir tapılmadı" });
  }

  const results = await Promise.all(rows.map(async (row: any, idx: number) => {
    const qaimeNumber = String(row.qaimeNumber ?? "").trim();
    const amount = Number(row.amount);
    const rowNumber = row.rowNumber ?? idx + 1;

    if (!qaimeNumber) {
      return {
        rowNumber, qaimeNumber, amount,
        matched: false, status: "error" as const,
        message: "Qaimə nömrəsi boşdur",
      };
    }
    if (!amount || amount <= 0 || isNaN(amount)) {
      return {
        rowNumber, qaimeNumber, amount,
        matched: false, status: "error" as const,
        message: "Məbləğ düzgün deyil",
      };
    }

    // Find sale(s) with this qaime number
    const sales = await db
      .select()
      .from(salesTable)
      .where(eq(salesTable.qaimeNumber, qaimeNumber));

    if (sales.length === 0) {
      return {
        rowNumber, qaimeNumber, amount,
        matched: false, status: "not_found" as const,
        message: "Qaimə nömrəsi tapılmadı",
      };
    }

    if (sales.length > 1) {
      return {
        rowNumber, qaimeNumber, amount,
        matched: false, status: "duplicate" as const,
        message: `${sales.length} satışda eyni qaimə var — sistemə düzəliş lazımdır`,
      };
    }

    const sale = sales[0];
    const totalAmount = Number(sale.totalAmount);
    const downPayment = Number(sale.downPayment ?? 0);
    const outstanding = await getOutstanding(sale.id, totalAmount, downPayment, sale.saleType);

    if (sale.saleType === "cash") {
      return {
        rowNumber, qaimeNumber, amount,
        matched: false, status: "cash_sale" as const,
        message: "Bu satış nağddır — taksit yoxdur",
        saleId: sale.id,
      };
    }

    if (outstanding <= 0.01) {
      return {
        rowNumber, qaimeNumber, amount,
        matched: false, status: "fully_paid" as const,
        message: "Bu satışın bütün borcu artıq ödənilib",
        saleId: sale.id,
      };
    }

    const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, sale.customerId)).limit(1);
    const assetDescription = await getAssetDescription(sale.assetType, sale.assetId);
    const willApply = Math.min(amount, outstanding);
    const overpayment = Math.max(0, amount - outstanding);

    return {
      rowNumber, qaimeNumber, amount,
      matched: true, status: "ready" as const,
      saleId: sale.id,
      customerName: customer ? `${customer.firstName} ${customer.lastName}` : "—",
      customerId: sale.customerId,
      assetDescription,
      currentBalance: outstanding,
      willApply: Math.round(willApply * 100) / 100,
      overpayment: Math.round(overpayment * 100) / 100,
      message: overpayment > 0
        ? `${willApply.toFixed(2)} AZN tətbiq olunacaq, ${overpayment.toFixed(2)} AZN artıq ödəniş`
        : `${willApply.toFixed(2)} AZN tətbiq olunacaq`,
    };
  }));

  // Summary
  const matchedCount = results.filter((r: any) => r.matched).length;
  const errorCount = results.filter((r: any) => !r.matched).length;
  const totalAmount = results.reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);
  const willApplyTotal = results
    .filter((r: any) => r.matched)
    .reduce((sum: number, r: any) => sum + (Number(r.willApply) || 0), 0);

  res.json({
    rows: results,
    summary: {
      total: results.length,
      matched: matchedCount,
      errors: errorCount,
      totalAmount: Math.round(totalAmount * 100) / 100,
      willApplyTotal: Math.round(willApplyTotal * 100) / 100,
    },
  });
});

// ── APPLY ─────────────────────────────────────────────────────────────────────
// Input: { payments: [{ saleId, amount, paymentDate, qaimeNumber? }] }
// Applies bulk-pay logic to each
router.post("/apply", async (req, res) => {
  const payments = Array.isArray(req.body?.payments) ? req.body.payments : [];
  if (payments.length === 0) {
    return res.status(400).json({ error: "Heç bir ödəniş tapılmadı" });
  }

  const applied: any[] = [];
  const failed: any[] = [];

  for (const p of payments) {
    const saleId = Number(p.saleId);
    const amount = Number(p.amount);
    const paidAt = p.paymentDate ? new Date(p.paymentDate) : new Date();

    if (!saleId || !amount || amount <= 0) {
      failed.push({ ...p, error: "Yanlış məlumat" });
      continue;
    }

    try {
      const pending = await db
        .select()
        .from(installmentsTable)
        .where(
          and(
            eq(installmentsTable.saleId, saleId),
            or(
              eq(installmentsTable.status, "pending"),
              eq(installmentsTable.status, "overdue"),
              eq(installmentsTable.status, "partial"),
            ),
          ),
        )
        .orderBy(installmentsTable.dueDate);

      let remaining = amount;
      let appliedAmount = 0;

      for (const inst of pending) {
        if (remaining <= 0) break;
        const instAmount = Number(inst.amount);
        const alreadyPaid = Number(inst.paidAmount ?? 0);
        const needsToPay = instAmount - alreadyPaid;
        if (needsToPay <= 0) continue;

        const toApply = Math.min(remaining, needsToPay);
        const newPaidAmount = alreadyPaid + toApply;
        remaining = Math.round((remaining - toApply) * 100) / 100;
        appliedAmount += toApply;

        const isFullyPaid = newPaidAmount >= instAmount - 0.01;
        await db
          .update(installmentsTable)
          .set({
            paidAmount: String(Math.round(newPaidAmount * 100) / 100),
            status: isFullyPaid ? "paid" : "partial",
            paidDate: isFullyPaid ? paidAt : inst.paidDate,
          })
          .where(eq(installmentsTable.id, inst.id));
      }

      applied.push({
        saleId,
        qaimeNumber: p.qaimeNumber ?? null,
        receivedAmount: amount,
        appliedAmount: Math.round(appliedAmount * 100) / 100,
        leftover: Math.round(remaining * 100) / 100,
      });
    } catch (err: any) {
      failed.push({ ...p, error: err?.message ?? "Bilinməyən xəta" });
    }
  }

  const totalApplied = applied.reduce((sum, a) => sum + a.appliedAmount, 0);

  res.json({
    success: true,
    applied,
    failed,
    summary: {
      successCount: applied.length,
      failedCount: failed.length,
      totalApplied: Math.round(totalApplied * 100) / 100,
    },
  });
});

export default router;
