import { Router } from "express";
import { db } from "@workspace/db";
import { customersTable, salesTable, apartmentsTable, objectsTable, blocksTable } from "@workspace/db/schema";
import { eq, or, ilike, sql } from "drizzle-orm";

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
      return {
        ...sale,
        customerName: `${customer.firstName} ${customer.lastName}`,
        assetDescription,
        totalAmount: Number(sale.totalAmount),
        downPayment: Number(sale.downPayment),
        monthlyPayment: Number(sale.monthlyPayment),
        paidAmount: 0,
        remainingAmount: Number(sale.totalAmount),
        progressPercent: 0,
        saleDate: sale.saleDate.toISOString(),
      };
    })
  );

  res.json({ ...customer, sales: enrichedSales });
});

export default router;
