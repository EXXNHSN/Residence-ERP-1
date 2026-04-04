import { Router } from "express";
import { db } from "@workspace/db";
import { customersTable, rentalsTable, objectsTable } from "@workspace/db/schema";
import { eq, inArray } from "drizzle-orm";

const router = Router();

// GET /renters — customers who have object (qeyri yaşayış) rentals
router.get("/", async (req, res) => {
  // Find all distinct customers with object rentals
  const rows = await db
    .select({
      rental: rentalsTable,
      customer: customersTable,
      object: objectsTable,
    })
    .from(rentalsTable)
    .innerJoin(customersTable, eq(rentalsTable.customerId, customersTable.id))
    .leftJoin(objectsTable, eq(rentalsTable.assetId, objectsTable.id))
    .where(eq(rentalsTable.assetType, "object"))
    .orderBy(customersTable.lastName, customersTable.firstName);

  // Group by customer, listing all their rentals
  const customerMap = new Map<number, any>();
  for (const row of rows) {
    const cid = row.customer.id;
    if (!customerMap.has(cid)) {
      customerMap.set(cid, {
        ...row.customer,
        rentals: [],
      });
    }
    customerMap.get(cid).rentals.push({
      ...row.rental,
      monthlyAmount: Number(row.rental.monthlyAmount),
      startDate: row.rental.startDate.toISOString(),
      endDate: row.rental.endDate.toISOString(),
      objectNumber: row.object?.number ?? null,
      objectType: row.object?.type ?? null,
    });
  }

  res.json(Array.from(customerMap.values()));
});

export default router;
