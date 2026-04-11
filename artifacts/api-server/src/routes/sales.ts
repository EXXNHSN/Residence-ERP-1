import { Router } from "express";
import { db } from "@workspace/db";
import {
  salesTable,
  installmentsTable,
  apartmentsTable,
  objectsTable,
  customersTable,
  blocksTable,
  tariffsTable,
} from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { verifyAdmin } from "./adminVerify";

const router = Router();

async function getAssetInfo(assetType: string, assetId: number) {
  if (assetType === "apartment") {
    const [row] = await db
      .select({ apt: apartmentsTable, blockName: blocksTable.name })
      .from(apartmentsTable)
      .leftJoin(blocksTable, eq(apartmentsTable.blockId, blocksTable.id))
      .where(eq(apartmentsTable.id, assetId));
    if (row) return { area: Number(row.apt.area), description: `${row.blockName} - Mənzil ${row.apt.number}` };
  } else {
    const [obj] = await db.select().from(objectsTable).where(eq(objectsTable.id, assetId));
    if (obj)
      return {
        area: Number(obj.area),
        description: `${obj.type === "garage" ? "Qaraj" : "Obyekt"} ${obj.number}`,
      };
  }
  return { area: 0, description: `#${assetId}` };
}

async function getInstallmentSummary(saleId: number) {
  const installments = await db
    .select()
    .from(installmentsTable)
    .where(eq(installmentsTable.saleId, saleId));

  const paidAmount = installments
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + Number(i.amount), 0);

  return { paidAmount, installments };
}

async function enrichSale(sale: typeof salesTable.$inferSelect) {
  const customer = await db.select().from(customersTable).where(eq(customersTable.id, sale.customerId)).limit(1);
  const asset = await getAssetInfo(sale.assetType, sale.assetId);
  const { paidAmount } = await getInstallmentSummary(sale.id);
  const totalAmount = Number(sale.totalAmount);
  const downPayment = Number(sale.downPayment);
  const totalPaid = sale.saleType === "cash" ? totalAmount : downPayment + paidAmount;
  const remaining = Math.max(0, totalAmount - totalPaid);
  const progress = totalAmount > 0 ? Math.min(100, (totalPaid / totalAmount) * 100) : 100;

  return {
    id: sale.id,
    customerId: sale.customerId,
    customerName: customer[0] ? `${customer[0].firstName} ${customer[0].lastName}` : "",
    customerPhone: customer[0]?.phone ?? "",
    assetType: sale.assetType,
    assetId: sale.assetId,
    assetDescription: asset.description,
    area: asset.area,
    saleType: sale.saleType,
    totalAmount,
    downPayment,
    installmentMonths: sale.installmentMonths,
    monthlyPayment: Number(sale.monthlyPayment),
    pricePerSqm: sale.pricePerSqm ? Number(sale.pricePerSqm) : null,
    contractNumber: sale.contractNumber ?? null,
    paidAmount: totalPaid,
    remainingAmount: remaining,
    saleDate: sale.saleDate.toISOString(),
    progressPercent: Math.round(progress),
  };
}

router.get("/", async (req, res) => {
  const { customerId, saleType } = req.query;
  let query = db.select().from(salesTable).$dynamic();

  const conditions: ReturnType<typeof eq>[] = [];
  if (customerId) conditions.push(eq(salesTable.customerId, Number(customerId)));
  if (saleType) conditions.push(eq(salesTable.saleType, saleType as string));

  if (conditions.length) {
    const { and } = await import("drizzle-orm");
    query = query.where(and(...conditions));
  }

  const sales = await query.orderBy(salesTable.saleDate);
  res.json(await Promise.all(sales.map(enrichSale)));
});

router.post("/calculate", async (req, res) => {
  const { area, pricePerSqm, downPayment, installmentMonths } = req.body;
  const totalAmount = Number(area) * Number(pricePerSqm);
  const creditAmount = Math.max(0, totalAmount - Number(downPayment));
  const monthlyPayment = installmentMonths > 0 ? creditAmount / Number(installmentMonths) : 0;
  res.json({
    totalAmount: Math.round(totalAmount * 100) / 100,
    downPayment: Number(downPayment),
    creditAmount: Math.round(creditAmount * 100) / 100,
    monthlyPayment: Math.round(monthlyPayment * 100) / 100,
    installmentMonths: Number(installmentMonths),
  });
});

router.post("/", async (req, res) => {
  const { customerId, assetType, assetId, saleType, downPayment, installmentMonths, pricePerSqm, totalAmountOverride, contractNumber } = req.body;

  const asset = await getAssetInfo(assetType, assetId);

  // For garages, use fixed price from tariffs (area is 0)
  let totalAmount: number;
  if (assetType === "garage" || totalAmountOverride) {
    if (totalAmountOverride) {
      totalAmount = Number(totalAmountOverride);
    } else {
      const [garagePriceTariff] = await db.select().from(tariffsTable).where(eq(tariffsTable.key, "garage_sale_price"));
      totalAmount = garagePriceTariff ? Number(garagePriceTariff.value) : 5000;
    }
  } else {
    totalAmount = asset.area * Number(pricePerSqm);
  }
  const creditAmount = Math.max(0, totalAmount - Number(downPayment));
  const months = saleType === "cash" ? 0 : Number(installmentMonths) || 0;
  const monthlyPayment = months > 0 ? creditAmount / months : 0;

  const [sale] = await db
    .insert(salesTable)
    .values({
      customerId,
      assetType,
      assetId,
      saleType,
      totalAmount: String(totalAmount),
      downPayment: String(downPayment ?? 0),
      installmentMonths: months,
      monthlyPayment: String(monthlyPayment),
      pricePerSqm: pricePerSqm ? String(pricePerSqm) : null,
      contractNumber: contractNumber?.trim() || null,
      saleDate: new Date(),
    })
    .returning();

  // Update asset status
  if (assetType === "apartment") {
    await db
      .update(apartmentsTable)
      .set({ status: "sold" })
      .where(eq(apartmentsTable.id, assetId));
  } else {
    await db
      .update(objectsTable)
      .set({ status: "sold" })
      .where(eq(objectsTable.id, assetId));
  }

  // Generate installment schedule for credit sales
  const installments: typeof installmentsTable.$inferInsert[] = [];
  if (saleType === "credit" && months > 0) {
    const baseAmount = Math.floor((creditAmount / months) * 100) / 100;
    const totalScheduled = baseAmount * (months - 1);
    const lastAmount = Math.round((creditAmount - totalScheduled) * 100) / 100;

    const saleDay = sale.saleDate.getDate();

    for (let i = 0; i < months; i++) {
      const dueDate = new Date(sale.saleDate);
      dueDate.setMonth(dueDate.getMonth() + i + 1);
      // Keep same day of month as sale date (e.g., sold on 10th → due on 10th)
      const maxDay = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0).getDate();
      dueDate.setDate(Math.min(saleDay, maxDay));
      installments.push({
        saleId: sale.id,
        installmentNumber: i + 1,
        dueDate,
        amount: String(i === months - 1 ? lastAmount : baseAmount),
        status: "pending",
      });
    }
    await db.insert(installmentsTable).values(installments);
  }

  const enriched = await enrichSale(sale);
  const { installments: dbInstallments } = await getInstallmentSummary(sale.id);

  res.status(201).json({
    ...enriched,
    installments: dbInstallments.map((inst) => ({
      ...inst,
      amount: Number(inst.amount),
      dueDate: inst.dueDate.toISOString(),
      paidDate: inst.paidDate?.toISOString() ?? null,
    })),
  });
});

router.delete("/:id", async (req, res) => {
  const { username, password } = req.body ?? {};
  if (!(await verifyAdmin(username, password, res))) return;

  const saleId = Number(req.params.id);
  const [sale] = await db.select().from(salesTable).where(eq(salesTable.id, saleId)).limit(1);
  if (!sale) return res.status(404).json({ error: "Satış tapılmadı" });

  // Reset asset status + handedOver for apartments
  if (sale.assetType === "apartment") {
    await db.update(apartmentsTable)
      .set({ status: "available", handedOver: false })
      .where(eq(apartmentsTable.id, sale.assetId));
  } else {
    await db.update(objectsTable)
      .set({ status: "available" })
      .where(eq(objectsTable.id, sale.assetId));
  }

  // Delete installments first, then the sale
  await db.delete(installmentsTable).where(eq(installmentsTable.saleId, saleId));
  await db.delete(salesTable).where(eq(salesTable.id, saleId));

  res.status(204).send();
});

router.get("/:id", async (req, res) => {
  const [sale] = await db.select().from(salesTable).where(eq(salesTable.id, Number(req.params.id)));
  if (!sale) return res.status(404).json({ error: "Not found" });

  const enriched = await enrichSale(sale);
  const { installments } = await getInstallmentSummary(sale.id);

  res.json({
    ...enriched,
    installments: installments.map((inst) => ({
      ...inst,
      amount: Number(inst.amount),
      dueDate: inst.dueDate.toISOString(),
      paidDate: inst.paidDate?.toISOString() ?? null,
    })),
  });
});

router.put("/:id", async (req, res) => {
  const { username, password, pricePerSqm, downPayment, installmentMonths, saleDate } = req.body ?? {};
  if (!(await verifyAdmin(username, password, res))) return;

  const saleId = Number(req.params.id);
  const [sale] = await db.select().from(salesTable).where(eq(salesTable.id, saleId)).limit(1);
  if (!sale) return res.status(404).json({ error: "Satış tapılmadı" });

  const updates: Partial<typeof salesTable.$inferInsert> = {};

  if (pricePerSqm !== undefined) {
    const ppsqm = Number(pricePerSqm);
    if (isNaN(ppsqm) || ppsqm <= 0) return res.status(400).json({ error: "Qiymət düzgün deyil" });
    updates.pricePerSqm = String(ppsqm);

    const asset = await getAssetInfo(sale.assetType, sale.assetId);
    const newTotal = asset.area * ppsqm;
    updates.totalAmount = String(newTotal);
    updates.remainingAmount = String(newTotal - Number(sale.downPayment));
  }

  if (downPayment !== undefined && sale.saleType === "credit") {
    const dp = Number(downPayment);
    if (isNaN(dp) || dp < 0) return res.status(400).json({ error: "İlkin ödəniş düzgün deyil" });
    updates.downPayment = String(dp);
    const total = Number(updates.totalAmount ?? sale.totalAmount);
    updates.remainingAmount = String(total - dp);
  }

  if (installmentMonths !== undefined && sale.saleType === "credit") {
    const months = Number(installmentMonths);
    if (isNaN(months) || months < 1) return res.status(400).json({ error: "Ay sayı düzgün deyil" });
    updates.installmentMonths = months;
  }

  if (saleDate !== undefined) {
    updates.saleDate = new Date(saleDate);
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "Heç bir dəyişiklik yoxdur" });
  }

  const [updated] = await db
    .update(salesTable)
    .set(updates)
    .where(eq(salesTable.id, saleId))
    .returning();

  if (updated && updated.installmentMonths && updated.saleType === "credit") {
    const total = Number(updated.totalAmount);
    const dp = Number(updated.downPayment);
    const months = updated.installmentMonths;
    const monthlyAmount = (total - dp) / months;

    const existingInstallments = await db
      .select()
      .from(installmentsTable)
      .where(eq(installmentsTable.saleId, saleId));

    const unpaid = existingInstallments.filter(i => i.status === "pending");
    for (const inst of unpaid) {
      await db
        .update(installmentsTable)
        .set({ amount: String(monthlyAmount) })
        .where(eq(installmentsTable.id, inst.id));
    }
  }

  res.json(await enrichSale(updated!));
});

export default router;
