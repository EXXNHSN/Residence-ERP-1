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
  communalBillsTable,
  saleTransfersTable,
} from "@workspace/db/schema";
import { eq, sql, and, desc, ne } from "drizzle-orm";
import { verifyAdmin } from "./adminVerify";

const router = Router();

// Ağıllı son ödəmə tarixi hesablama (ay sonları və artıq illəri dəqiq nəzərə alır)
function calculateDueDate(baseDate: Date, monthIndex: number): Date {
  const d = new Date(baseDate);
  const targetMonth = d.getMonth() + monthIndex;
  const targetYear = d.getFullYear() + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;
  const targetDay = baseDate.getDate();
  const maxDaysInMonth = new Date(targetYear, normalizedMonth + 1, 0).getDate();
  const day = Math.min(targetDay, maxDaysInMonth);
  return new Date(targetYear, normalizedMonth, day, 12, 0, 0);
}

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
    .where(eq(installmentsTable.saleId, saleId))
    .orderBy(installmentsTable.installmentNumber);

  const paidAmount = installments.reduce((sum, i) => {
    const directPaid = Number(i.paidAmount ?? 0);
    if (directPaid > 0) return sum + directPaid;
    return i.status === "paid" ? sum + Number(i.amount) : sum;
  }, 0);

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
    qaimeNumber: sale.qaimeNumber ?? null,
    paidAmount: Math.round(totalPaid * 100) / 100,
    remainingAmount: Math.round(remaining * 100) / 100,
    saleDate: sale.saleDate.toISOString(),
    progressPercent: Math.round(progress),
  };
}

router.get("/", async (req, res): Promise<void> => {
  const { customerId, saleType } = req.query;
  let query = db.select().from(salesTable).$dynamic();

  const conditions: ReturnType<typeof eq>[] = [];
  if (customerId) conditions.push(eq(salesTable.customerId, Number(customerId)));
  if (saleType) conditions.push(eq(salesTable.saleType, saleType as "cash" | "credit"));

  if (conditions.length) {
    query = query.where(and(...conditions));
  }

  const sales = await query.orderBy(desc(salesTable.saleDate));
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
  const {
    customerId,
    assetType,
    assetId,
    saleType,
    downPayment,
    installmentMonths,
    pricePerSqm,
    totalAmountOverride,
    contractNumber,
    qaimeNumber,
    saleDate,
    initialPaidAmount,
    customArea,
  } = req.body;

  const trimmedContractNumber = contractNumber?.trim();
  const trimmedQaimeNumber = qaimeNumber?.trim();

  // 1. Müqavilə və Qaimə nömrələri məcburidir
  if (!trimmedContractNumber) {
    return res.status(400).json({ error: "Müqavilə nömrəsi mütləq daxil edilməlidir" });
  }
  if (!trimmedQaimeNumber) {
    return res.status(400).json({ error: "Qaimə nömrəsi mütləq daxil edilməlidir" });
  }

  // 2. Müqavilə nömrəsinin unikallığı
  const existingContract = await db
    .select({ id: salesTable.id })
    .from(salesTable)
    .where(eq(salesTable.contractNumber, trimmedContractNumber))
    .limit(1);
  if (existingContract.length > 0) {
    return res.status(400).json({
      error: `«${trimmedContractNumber}» nömrəli müqavilə artıq mövcuddur! Eyni müqavilə nömrəsi ilə iki fərqli satış edilə bilməz.`,
    });
  }

  // 3. Qaimə nömrəsinin unikallığı
  const existingQaime = await db
    .select({ id: salesTable.id })
    .from(salesTable)
    .where(eq(salesTable.qaimeNumber, trimmedQaimeNumber))
    .limit(1);
  if (existingQaime.length > 0) {
    return res.status(400).json({
      error: `«${trimmedQaimeNumber}» nömrəli qaimə artıq mövcuddur! Eyni qaimə nömrəsi ilə iki fərqli satış edilə bilməz.`,
    });
  }

  const effectiveSaleDate = saleDate ? new Date(saleDate) : new Date();
  const asset = await getAssetInfo(assetType, assetId);
  const effectiveArea = (assetType === "object" && customArea && Number(customArea) > 0)
    ? Number(customArea)
    : asset.area;

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
    totalAmount = effectiveArea * Number(pricePerSqm);
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
      contractNumber: trimmedContractNumber,
      qaimeNumber: trimmedQaimeNumber,
      saleDate: effectiveSaleDate,
    })
    .returning();

  // Update asset status
  if (assetType === "apartment") {
    await db
      .update(apartmentsTable)
      .set({ status: "sold" })
      .where(eq(apartmentsTable.id, assetId));
  } else {
    const objUpdates: any = { status: "sold" };
    if (assetType === "object" && customArea && Number(customArea) > 0) {
      objUpdates.area = String(customArea);
    }
    await db
      .update(objectsTable)
      .set(objUpdates)
      .where(eq(objectsTable.id, assetId));
  }

  // Generate installment schedule for credit sales
  const installments: typeof installmentsTable.$inferInsert[] = [];
  if (saleType === "credit" && months > 0) {
    const baseAmount = Math.floor((creditAmount / months) * 100) / 100;
    const totalScheduled = baseAmount * (months - 1);
    const lastAmount = Math.round((creditAmount - totalScheduled) * 100) / 100;

    let unapplied = Number(initialPaidAmount) || 0;
    const now = new Date();

    for (let i = 0; i < months; i++) {
      const dueDate = calculateDueDate(effectiveSaleDate, i + 1);
      const instAmount = i === months - 1 ? lastAmount : baseAmount;

      let paidAmt = 0;
      let status: "pending" | "paid" | "overdue" | "partial" = "pending";
      let paidDate: Date | null = null;

      if (unapplied > 0) {
        if (unapplied >= instAmount - 0.01) {
          paidAmt = instAmount;
          unapplied = Math.round((unapplied - instAmount) * 100) / 100;
          status = "paid";
          paidDate = effectiveSaleDate;
        } else {
          paidAmt = unapplied;
          unapplied = 0;
          status = dueDate <= now ? "overdue" : "partial";
          paidDate = effectiveSaleDate;
        }
      } else {
        status = dueDate <= now ? "overdue" : "pending";
      }

      installments.push({
        saleId: sale.id,
        installmentNumber: i + 1,
        dueDate,
        amount: String(instAmount),
        paidAmount: String(paidAmt),
        status,
        paidDate,
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
      paidAmount: Number(inst.paidAmount ?? 0),
      dueDate: inst.dueDate.toISOString(),
      paidDate: inst.paidDate?.toISOString() ?? null,
    })),
  });
});

router.delete("/:id", async (req, res): Promise<void> => {
  const { username, password } = req.body ?? {};
  if (!(await verifyAdmin(username, password, res))) return;

  const saleId = Number(req.params.id);
  const [sale] = await db.select().from(salesTable).where(eq(salesTable.id, saleId)).limit(1);
  if (!sale) { res.status(404).json({ error: "Satış tapılmadı" }); return; }

  // 1. Installments silinir
  await db.delete(installmentsTable).where(eq(installmentsTable.saleId, saleId));

  // 2. Transfer tarixçəsi silinir
  await db.delete(saleTransfersTable).where(eq(saleTransfersTable.saleId, saleId));

  // 3. Əlaqəli kommunal borclar silinir
  await db.delete(communalBillsTable).where(
    and(
      eq(communalBillsTable.assetType, sale.assetType),
      eq(communalBillsTable.assetId, sale.assetId)
    )
  );

  // 4. Aktivin statusu "available" edilir və təhvil sıfırlanır
  if (sale.assetType === "apartment") {
    await db.update(apartmentsTable)
      .set({ status: "available", handedOver: false })
      .where(eq(apartmentsTable.id, sale.assetId));
  } else {
    await db.update(objectsTable)
      .set({ status: "available" })
      .where(eq(objectsTable.id, sale.assetId));
  }

  // 5. Satışın özü silinir
  await db.delete(salesTable).where(eq(salesTable.id, saleId));

  res.status(204).send();
});

router.get("/:id", async (req, res): Promise<void> => {
  const [sale] = await db
    .select()
    .from(salesTable)
    .where(eq(salesTable.id, Number(req.params.id)));

  if (!sale) { res.status(404).json({ error: "Not found" }); return; }

  const enriched = await enrichSale(sale);
  const { installments } = await getInstallmentSummary(sale.id);

  res.json({
    ...enriched,
    installments: installments.map((inst) => ({
      ...inst,
      amount: Number(inst.amount),
      paidAmount: Number(inst.paidAmount ?? 0),
      dueDate: inst.dueDate.toISOString(),
      paidDate: inst.paidDate?.toISOString() ?? null,
    })),
  });
});

// Admin redaktəsi: Tarix, qiymət, müqavilə/qaimə nömrəsi və ödənilmiş cəmi məbləğin dəqiq tənzimlənməsi
router.put("/:id", async (req, res): Promise<void> => {
  const {
    username,
    password,
    pricePerSqm,
    downPayment,
    installmentMonths,
    saleDate,
    qaimeNumber,
    contractNumber,
    initialPaidAmount,
  } = req.body ?? {};

  if (!(await verifyAdmin(username, password, res))) return;

  const saleId = Number(req.params.id);
  const [sale] = await db.select().from(salesTable).where(eq(salesTable.id, saleId)).limit(1);
  if (!sale) { res.status(404).json({ error: "Satış tapılmadı" }); return; }

  const updates: Partial<typeof salesTable.$inferInsert> = {};
  let dateChanged = false;
  let newSaleDate = new Date(sale.saleDate);

  if (saleDate !== undefined) {
    const parsedDate = new Date(saleDate);
    if (!isNaN(parsedDate.getTime())) {
      updates.saleDate = parsedDate;
      newSaleDate = parsedDate;
      dateChanged = true;
    }
  }

  if (pricePerSqm !== undefined) {
    const ppsqm = Number(pricePerSqm);
    if (isNaN(ppsqm) || ppsqm <= 0) { res.status(400).json({ error: "Qiymət düzgün deyil" }); return; }
    updates.pricePerSqm = String(ppsqm);

    const asset = await getAssetInfo(sale.assetType, sale.assetId);
    const newTotal = asset.area * ppsqm;
    updates.totalAmount = String(newTotal);
  }

  if (downPayment !== undefined && sale.saleType === "credit") {
    const dp = Number(downPayment);
    if (isNaN(dp) || dp < 0) { res.status(400).json({ error: "İlkin ödəniş düzgün deyil" }); return; }
    updates.downPayment = String(dp);
  }

  if (installmentMonths !== undefined && sale.saleType === "credit") {
    const months = Number(installmentMonths);
    if (isNaN(months) || months < 1) { res.status(400).json({ error: "Ay sayı düzgün deyil" }); return; }
    updates.installmentMonths = months;
  }

  if (qaimeNumber !== undefined) {
    const trimmed = String(qaimeNumber).trim();
    if (!trimmed) {
      res.status(400).json({ error: "Qaimə nömrəsi boş ola bilməz" });
      return;
    }
    const [existing] = await db
      .select({ id: salesTable.id })
      .from(salesTable)
      .where(and(eq(salesTable.qaimeNumber, trimmed), ne(salesTable.id, saleId)))
      .limit(1);
    if (existing) {
      res.status(400).json({ error: `«${trimmed}» nömrəli qaimə artıq başqa satışda mövcuddur!` });
      return;
    }
    updates.qaimeNumber = trimmed;
  }

  if (contractNumber !== undefined) {
    const trimmed = String(contractNumber).trim();
    if (!trimmed) {
      res.status(400).json({ error: "Müqavilə nömrəsi boş ola bilməz" });
      return;
    }
    const [existing] = await db
      .select({ id: salesTable.id })
      .from(salesTable)
      .where(and(eq(salesTable.contractNumber, trimmed), ne(salesTable.id, saleId)))
      .limit(1);
    if (existing) {
      res.status(400).json({ error: `«${trimmed}» nömrəli müqavilə artıq başqa satışda mövcuddur!` });
      return;
    }
    updates.contractNumber = trimmed;
  }

  if (Object.keys(updates).length === 0 && initialPaidAmount === undefined) {
    res.status(400).json({ error: "Heç bir dəyişiklik yoxdur" });
    return;
  }

  await db.transaction(async (tx) => {
    let updated = sale;
    if (Object.keys(updates).length > 0) {
      const [u] = await tx
        .update(salesTable)
        .set(updates)
        .where(eq(salesTable.id, saleId))
        .returning();
      if (u) updated = u;
    }

    if (updated.saleType === "credit") {
      const existingInstallments = await tx
        .select()
        .from(installmentsTable)
        .where(eq(installmentsTable.saleId, saleId))
        .orderBy(installmentsTable.installmentNumber);

      const now = new Date();

      // 1. Əgər Admin birbaşa "İndiyə qədər ödənilmiş cəmi məbləğ" daxil edibsə
      if (initialPaidAmount !== undefined && !isNaN(Number(initialPaidAmount))) {
        let unapplied = Number(initialPaidAmount) || 0;
        for (const inst of existingInstallments) {
          const instAmount = Number(inst.amount);
          const newDueDate = dateChanged
            ? calculateDueDate(newSaleDate, inst.installmentNumber)
            : new Date(inst.dueDate);

          let paidAmt = 0;
          let status: "pending" | "paid" | "overdue" | "partial" = "pending";
          let paidDate: Date | null = null;

          if (unapplied > 0) {
            if (unapplied >= instAmount - 0.01) {
              paidAmt = instAmount;
              unapplied = Math.round((unapplied - instAmount) * 100) / 100;
              status = "paid";
              paidDate = inst.paidDate ?? newSaleDate;
            } else {
              paidAmt = unapplied;
              unapplied = 0;
              status = newDueDate <= now ? "overdue" : "partial";
              paidDate = inst.paidDate ?? newSaleDate;
            }
          } else {
            status = newDueDate <= now ? "overdue" : "pending";
          }

          await tx
            .update(installmentsTable)
            .set({
              dueDate: newDueDate,
              paidAmount: String(paidAmt),
              status,
              paidDate,
            })
            .where(eq(installmentsTable.id, inst.id));
        }
      } else {
        // 2. initialPaidAmount verilməyibsə, yalnız tarix və maliyyə şərtləri dəyişibsə:
        if (dateChanged) {
          for (const inst of existingInstallments) {
            const newDueDate = calculateDueDate(newSaleDate, inst.installmentNumber);
            let newStatus = inst.status;

            if (inst.status === "paid") {
              newStatus = "paid";
            } else {
              const paidAmt = Number(inst.paidAmount ?? 0);
              if (newDueDate <= now) {
                newStatus = "overdue";
              } else {
                newStatus = paidAmt > 0 ? "partial" : "pending";
              }
            }

            await tx
              .update(installmentsTable)
              .set({
                dueDate: newDueDate,
                status: newStatus,
              })
              .where(eq(installmentsTable.id, inst.id));
          }
        }

        const financialTermsChanged = pricePerSqm !== undefined || downPayment !== undefined || installmentMonths !== undefined;
        if (financialTermsChanged) {
          const total = Number(updated.totalAmount);
          const dp = Number(updated.downPayment);
          const totalCredit = Math.max(0, total - dp);

          const alreadyPaidTotal = existingInstallments.reduce((sum, i) => {
            const directPaid = Number(i.paidAmount ?? 0);
            if (directPaid > 0) return sum + directPaid;
            return i.status === "paid" ? sum + Number(i.amount) : sum;
          }, 0);

          const remainingCredit = Math.max(0, totalCredit - alreadyPaidTotal);
          const unpaid = existingInstallments.filter((i) => i.status !== "paid");

          if (unpaid.length > 0) {
            const newMonthlyAmount = Math.round((remainingCredit / unpaid.length) * 100) / 100;
            for (let idx = 0; idx < unpaid.length; idx++) {
              const isLast = idx === unpaid.length - 1;
              const scheduledSoFar = newMonthlyAmount * (unpaid.length - 1);
              const thisAmount = isLast ? Math.round((remainingCredit - scheduledSoFar) * 100) / 100 : newMonthlyAmount;

              await tx
                .update(installmentsTable)
                .set({ amount: String(thisAmount) })
                .where(eq(installmentsTable.id, unpaid[idx].id));
            }
          }
        }
      }
    }
  });

  const [refreshed] = await db.select().from(salesTable).where(eq(salesTable.id, saleId)).limit(1);
  res.json(await enrichSale(refreshed));
});

// Mənzilin başqa şəxsə satılması (Sahib dəyişməsi / Mülkiyyət ötürülməsi)
router.post("/:id/transfer", async (req, res): Promise<void> => {
  const { username, password, newCustomerId, transferDate, note } = req.body ?? {};
  if (!(await verifyAdmin(username, password, res))) return;

  const saleId = Number(req.params.id);
  const [sale] = await db.select().from(salesTable).where(eq(salesTable.id, saleId)).limit(1);
  if (!sale) { res.status(404).json({ error: "Satış tapılmadı" }); return; }

  const [newCustomer] = await db.select().from(customersTable).where(eq(customersTable.id, Number(newCustomerId))).limit(1);
  if (!newCustomer) { res.status(404).json({ error: "Yeni müştəri tapılmadı" }); return; }

  const oldCustomerId = sale.customerId;

  await db.transaction(async (tx) => {
    await tx.insert(saleTransfersTable).values({
      saleId,
      fromCustomerId: oldCustomerId,
      toCustomerId: Number(newCustomerId),
      transferDate: transferDate ? new Date(transferDate) : new Date(),
      note: note ?? null,
    });

    await tx.update(salesTable)
      .set({ customerId: Number(newCustomerId) })
      .where(eq(salesTable.id, saleId));

    await tx.update(communalBillsTable)
      .set({ ownerCustomerId: Number(newCustomerId) })
      .where(
        and(
          eq(communalBillsTable.assetType, sale.assetType),
          eq(communalBillsTable.assetId, sale.assetId)
        )
      );
  });

  const [updatedSale] = await db.select().from(salesTable).where(eq(salesTable.id, saleId)).limit(1);
  res.json(await enrichSale(updatedSale));
});

// Satışın transfer tarixçəsini gətirir
router.get("/:id/transfers", async (req, res): Promise<void> => {
  const saleId = Number(req.params.id);
  const transfers = await db
    .select({
      id: saleTransfersTable.id,
      saleId: saleTransfersTable.saleId,
      transferDate: saleTransfersTable.transferDate,
      note: saleTransfersTable.note,
      createdAt: saleTransfersTable.createdAt,
      oldCustomerFirstName: sql<string>`old_c.first_name`,
      oldCustomerLastName: sql<string>`old_c.last_name`,
      oldCustomerPhone: sql<string>`old_c.phone`,
      newCustomerFirstName: sql<string>`new_c.first_name`,
      newCustomerLastName: sql<string>`new_c.last_name`,
      newCustomerPhone: sql<string>`new_c.phone`,
    })
    .from(saleTransfersTable)
    .leftJoin(sql`customers old_c`, sql`old_c.id = ${saleTransfersTable.fromCustomerId}`)
    .leftJoin(sql`customers new_c`, sql`new_c.id = ${saleTransfersTable.toCustomerId}`)
    .where(eq(saleTransfersTable.saleId, saleId))
    .orderBy(desc(saleTransfersTable.transferDate));

  res.json(transfers);
});

export default router;
