import { Router } from "express";
import { db } from "@workspace/db";
import { customersTable, salesTable, apartmentsTable, objectsTable, blocksTable, installmentsTable, rentalsTable, objectPaymentsTable } from "@workspace/db/schema";
import { eq, or, ilike, inArray } from "drizzle-orm";
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

// POST /customers — FIN-based deduplication: if same FIN exists, return existing customer
router.post("/", async (req, res) => {
  const { firstName, lastName, fin, phone, address } = req.body;

  if (fin?.trim()) {
    const [existing] = await db
      .select()
      .from(customersTable)
      .where(eq(customersTable.fin, fin.trim()))
      .limit(1);
    if (existing) return res.status(200).json(existing);
  }

  const [customer] = await db
    .insert(customersTable)
    .values({ firstName, lastName, fin: fin?.trim() || null, phone, address })
    .returning();
  res.status(201).json(customer);
});

// GET /customers/by-fin/:fin — lookup by FIN number
router.get("/by-fin/:fin", async (req, res) => {
  const [customer] = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.fin, req.params.fin.trim()))
    .limit(1);
  if (!customer) return res.status(404).json({ error: "Tapılmadı" });
  res.json(customer);
});

router.get("/:id", async (req, res) => {
  const customerId = Number(req.params.id);
  const [customer] = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.id, customerId));

  if (!customer) return res.status(404).json({ error: "Not found" });

  // ── Sales ──
  const sales = await db.select().from(salesTable).where(eq(salesTable.customerId, customerId));

  const enrichedSales = await Promise.all(
    sales.map(async (sale) => {
      let assetDescription = `#${sale.assetId}`;
      let paymentCode: string | null = null;

      if (sale.assetType === "apartment") {
        const [apt] = await db
          .select({ apt: apartmentsTable, blockName: blocksTable.name })
          .from(apartmentsTable)
          .leftJoin(blocksTable, eq(apartmentsTable.blockId, blocksTable.id))
          .where(eq(apartmentsTable.id, sale.assetId));
        if (apt) {
          assetDescription = `${apt.blockName} - Mənzil ${apt.apt.number}`;
          paymentCode = apt.apt.paymentCode ?? null;
        }
      } else {
        const [obj] = await db.select().from(objectsTable).where(eq(objectsTable.id, sale.assetId));
        if (obj) assetDescription = `${obj.type === "garage" ? "Avto Dayanacaq" : "Qeyri Yaşayış"} ${obj.number}`;
      }

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
        paymentCode,
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

  // ── Rentals ──
  const rentals = await db.select().from(rentalsTable).where(eq(rentalsTable.customerId, customerId));

  const enrichedRentals = await Promise.all(
    rentals.map(async (rental) => {
      let assetDescription = `#${rental.assetId}`;
      if (rental.assetId) {
        const [obj] = await db.select().from(objectsTable).where(eq(objectsTable.id, rental.assetId));
        if (obj) assetDescription = `${obj.type === "garage" ? "Avto Dayanacaq" : "Qeyri Yaşayış"} ${obj.number}`;
      }
      return {
        ...rental,
        assetDescription,
        monthlyAmount: Number(rental.monthlyAmount),
        startDate: rental.startDate.toISOString(),
        endDate: rental.endDate.toISOString(),
      };
    })
  );

  res.json({ ...customer, sales: enrichedSales, rentals: enrichedRentals });
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

router.delete("/:id", async (req, res) => {
  const { username, password } = req.body ?? {};
  if (!(await verifyAdmin(username, password, res))) return;

  const customerId = Number(req.params.id);
  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, customerId)).limit(1);
  if (!customer) return res.status(404).json({ error: "Tapılmadı" });

  const sales = await db.select().from(salesTable).where(eq(salesTable.customerId, customerId));

  for (const sale of sales) {
    if (sale.assetType === "apartment") {
      await db.update(apartmentsTable)
        .set({ status: "available" })
        .where(eq(apartmentsTable.id, sale.assetId));
    } else {
      await db.update(objectsTable)
        .set({ status: "available" })
        .where(eq(objectsTable.id, sale.assetId));
    }
  }

  if (sales.length > 0) {
    const saleIds = sales.map(s => s.id);
    await db.delete(installmentsTable).where(inArray(installmentsTable.saleId, saleIds));
    await db.delete(salesTable).where(inArray(salesTable.id, saleIds));
  }

  const customerRentals = await db.select({ id: rentalsTable.id }).from(rentalsTable).where(eq(rentalsTable.customerId, customerId));
  if (customerRentals.length > 0) {
    const rentalIds = customerRentals.map(r => r.id);
    await db.delete(objectPaymentsTable).where(inArray(objectPaymentsTable.rentalId, rentalIds));
    for (const rental of customerRentals) {
      const [r] = await db.select().from(rentalsTable).where(eq(rentalsTable.id, rental.id)).limit(1);
      if (r) await db.update(objectsTable).set({ status: "available" }).where(eq(objectsTable.id, r.assetId));
    }
    await db.delete(rentalsTable).where(inArray(rentalsTable.id, rentalIds));
  }

  await db.delete(customersTable).where(eq(customersTable.id, customerId));
  res.status(204).send();
});

export default router;
