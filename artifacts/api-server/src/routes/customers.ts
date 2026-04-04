import { Router } from "express";
import { db } from "@workspace/db";
import { customersTable, salesTable, apartmentsTable, objectsTable, blocksTable, buildingsTable, quartersTable, installmentsTable, rentalsTable, objectPaymentsTable } from "@workspace/db/schema";
import { eq, or, ilike, inArray, and } from "drizzle-orm";
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

  const customers = await query.orderBy(customersTable.lastName, customersTable.firstName);

  if (customers.length === 0) return res.json([]);

  const customerIds = customers.map(c => c.id);

  // Bulk fetch sales and active rentals to build badge info
  const [allSales, allRentals] = await Promise.all([
    db.select({ customerId: salesTable.customerId, assetType: salesTable.assetType })
      .from(salesTable)
      .where(inArray(salesTable.customerId, customerIds)),
    db.select({ customerId: rentalsTable.customerId, assetType: rentalsTable.assetType, status: rentalsTable.status })
      .from(rentalsTable)
      .where(inArray(rentalsTable.customerId, customerIds)),
  ]);

  const badgeMap: Record<number, { apartment?: boolean; garageSale?: boolean; garageRental?: boolean; objectSale?: boolean; objectRental?: boolean }> = {};
  for (const s of allSales) {
    if (!badgeMap[s.customerId]) badgeMap[s.customerId] = {};
    if (s.assetType === "apartment") badgeMap[s.customerId].apartment = true;
    if (s.assetType === "garage") badgeMap[s.customerId].garageSale = true;
    if (s.assetType === "object") badgeMap[s.customerId].objectSale = true;
  }
  for (const r of allRentals) {
    if (!badgeMap[r.customerId!]) badgeMap[r.customerId!] = {};
    if (r.assetType === "garage") badgeMap[r.customerId!].garageRental = true;
    if (r.assetType === "object") badgeMap[r.customerId!].objectRental = true;
  }

  res.json(customers.map(c => ({ ...c, badges: badgeMap[c.id] ?? {} })));
});

function finValidation(fin: string | null | undefined): string | null {
  if (!fin) return null;
  if (fin.length !== 7) return "FIN kodu dəqiq 7 simvol olmalıdır";
  if (!/^[A-Za-z0-9]{7}$/.test(fin)) return "FIN kodunda yalnız hərf və rəqəm ola bilər";
  return null;
}

// POST /customers — FIN-based deduplication: if same FIN exists, return existing customer
router.post("/", async (req, res) => {
  const { firstName, lastName, fin, phone, address } = req.body;
  const finErr = finValidation(fin);
  if (finErr) return res.status(400).json({ error: finErr });

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

// GET /customers/:id/building — returns the customer's apartment building info for smart garage assignment
router.get("/:id/building", async (req, res) => {
  const customerId = Number(req.params.id);
  const sales = await db.select().from(salesTable)
    .where(eq(salesTable.customerId, customerId));
  const aptSale = sales.find(s => s.assetType === "apartment");
  if (!aptSale) return res.json({ buildingId: null, buildingName: null, quarterId: null, quarterName: null, blockId: null, blockName: null, apartmentNumber: null });

  const [row] = await db
    .select({
      apt: apartmentsTable,
      blockId: blocksTable.id,
      blockName: blocksTable.name,
      buildingId: buildingsTable.id,
      buildingName: buildingsTable.name,
      quarterId: quartersTable.id,
      quarterName: quartersTable.name,
    })
    .from(apartmentsTable)
    .leftJoin(blocksTable, eq(apartmentsTable.blockId, blocksTable.id))
    .leftJoin(buildingsTable, eq(blocksTable.buildingId, buildingsTable.id))
    .leftJoin(quartersTable, eq(buildingsTable.quarterId, quartersTable.id))
    .where(eq(apartmentsTable.id, aptSale.assetId))
    .limit(1);

  if (!row) return res.json({ buildingId: null, buildingName: null, quarterId: null, quarterName: null, blockId: null, blockName: null, apartmentNumber: null });

  res.json({
    buildingId: row.buildingId,
    buildingName: row.buildingName,
    quarterId: row.quarterId,
    quarterName: row.quarterName,
    blockId: row.blockId,
    blockName: row.blockName,
    apartmentNumber: row.apt.number,
  });
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

      let quarterName: string | null = null;
      let buildingName: string | null = null;
      let blockName: string | null = null;
      let aptNumber: string | null = null;

      if (sale.assetType === "apartment") {
        const [apt] = await db
          .select({
            apt: apartmentsTable,
            blockName: blocksTable.name,
            buildingName: buildingsTable.name,
            quarterName: quartersTable.name,
          })
          .from(apartmentsTable)
          .leftJoin(blocksTable, eq(apartmentsTable.blockId, blocksTable.id))
          .leftJoin(buildingsTable, eq(blocksTable.buildingId, buildingsTable.id))
          .leftJoin(quartersTable, eq(buildingsTable.quarterId, quartersTable.id))
          .where(eq(apartmentsTable.id, sale.assetId));
        if (apt) {
          blockName = apt.blockName;
          buildingName = apt.buildingName;
          quarterName = apt.quarterName;
          aptNumber = String(apt.apt.number);
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
        quarterName,
        buildingName,
        blockName,
        aptNumber,
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
  const finErr = finValidation(fin);
  if (finErr) return res.status(400).json({ error: finErr });
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
