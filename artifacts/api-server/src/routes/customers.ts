import { Router } from "express";
import { db } from "@workspace/db";
import { customersTable, salesTable, apartmentsTable, objectsTable, blocksTable, installmentsTable } from "@workspace/db/schema";
import { eq, or, ilike } from "drizzle-orm";
import { verifyAdmin } from "./adminVerify";

const router = Router();

router.get("/", async (req, res) => {
  const { search } = req.query;
  let query = db.select().from(customersTable).$dynamic();

  if (search) {
    const term = `%${search}%`;
    query = query.where(
      or(
        ilike(customersTable.firstName, term),
        ilike(customersTable.lastName, term),
        ilike(customersTable.phone, term),
        ilike(customersTable.fin, term)
      )
    );
  }

  res.json(await query.orderBy(customersTable.lastName, customersTable.firstName));
});

router.post("/", async (req, res) => {
  const { firstName, lastName, fin, phone, address } = req.body;
  const [customer] = await db
    .insert(customersTable)
    .values({ firstName, lastName, fin, phone, address })
    .returning();
  res.status(201).json(customer);
});

router.get("/:id", async (req, res) => {
  const customerId = Number(req.params.id);
  const [customer] = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.id, customerId));

  if (!customer) return res.status(404).json({ error: "Not found" });

  const sales = await db.select().from(salesTable).where(eq(salesTable.customerId, customerId));

  const enrichedSales = await Promise.all(
    sales.map(async (sale) => {
      // Asset description
      let assetDescription = `#${sale.assetId}`;
      if (sale.assetType === "apartment") {
        const [apt] = await db
          .select({ apt: apartmentsTable, blockName: blocksTable.name })
          .from(apartmentsTable)
          .leftJoin(blocksTable, eq(apartmentsTable.blockId, blocksTable.id))
          .where(eq(apartmentsTable.id, sale.assetId));
        if (apt) assetDescription = `${apt.blockName} - Mənzil ${apt.apt.number}`;
      } else {
        const [obj] = await db.select().from(objectsTable).where(eq(objectsTable.id, sale.assetId));
        if (obj) assetDescription = `${obj.type === "garage" ? "Qaraj" : "Obyekt"} ${obj.number}`;
      }

      // Calculate paid amount from installments
      const installments = await db
        .select()
        .from(installmentsTable)
        .where(eq(installmentsTable.saleId, sale.id));

      const paidInstallmentsTotal = installments
        .filter((i) => i.status === "paid")
        .reduce((sum, i) => sum + Number(i.amount), 0);

      const totalAmount = Number(sale.totalAmount);
      const downPayment = Number(sale.downPayment);
      const paidAmount = sale.saleType === "cash"
        ? totalAmount
        : downPayment + paidInstallmentsTotal;
      const remainingAmount = Math.max(0, totalAmount - paidAmount);
      const progressPercent = totalAmount > 0
        ? Math.round(Math.min(100, (paidAmount / totalAmount) * 100))
        : 100;

      return {
        ...sale,
        customerName: `${customer.firstName} ${customer.lastName}`,
        assetDescription,
        totalAmount,
        downPayment,
        monthlyPayment: Number(sale.monthlyPayment),
        paidAmount,
        remainingAmount,
        progressPercent,
        saleDate: sale.saleDate.toISOString(),
      };
    })
  );

  res.json({ ...customer, sales: enrichedSales });
});

router.put("/:id", async (req, res) => {
  const { username, password, firstName, lastName, fin, phone, address } = req.body ?? {};
  if (!(await verifyAdmin(username, password, res))) return;
  if (!firstName?.trim() || !lastName?.trim() || !phone?.trim()) {
    return res.status(400).json({ error: "Ad, soyad və telefon tələb olunur" });
  }
  const [updated] = await db
    .update(customersTable)
    .set({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
      fin: fin?.trim() || null,
      address: address?.trim() || null,
    })
    .where(eq(customersTable.id, Number(req.params.id)))
    .returning();
  if (!updated) return res.status(404).json({ error: "Tapılmadı" });
  res.json(updated);
});

export default router;
