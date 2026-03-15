import { Router } from "express";
import { db } from "@workspace/db";
import { rentalsTable, customersTable, objectsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router = Router();

async function enrichRental(rental: typeof rentalsTable.$inferSelect) {
  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, rental.customerId));
  const [obj] = await db.select().from(objectsTable).where(eq(objectsTable.id, rental.assetId));

  const endDate = new Date(rental.endDate);
  const now = new Date();
  const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  return {
    id: rental.id,
    assetType: rental.assetType,
    assetId: rental.assetId,
    assetDescription: obj ? `${obj.type === "garage" ? "Qaraj" : "Obyekt"} ${obj.number}` : `#${rental.assetId}`,
    customerId: rental.customerId,
    customerName: customer ? `${customer.firstName} ${customer.lastName}` : "",
    startDate: rental.startDate.toISOString(),
    endDate: rental.endDate.toISOString(),
    monthlyAmount: Number(rental.monthlyAmount),
    status: rental.status,
    daysRemaining,
  };
}

router.get("/", async (req, res) => {
  const { status } = req.query;
  let query = db.select().from(rentalsTable).$dynamic();
  if (status) query = query.where(eq(rentalsTable.status, status as string));

  const rentals = await query.orderBy(rentalsTable.startDate);
  res.json(await Promise.all(rentals.map(enrichRental)));
});

router.post("/", async (req, res) => {
  const { assetType, assetId, customerId, startDate, endDate, monthlyAmount } = req.body;

  const [rental] = await db
    .insert(rentalsTable)
    .values({
      assetType,
      assetId,
      customerId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      monthlyAmount: String(monthlyAmount),
      status: "active",
    })
    .returning();

  // Update asset status to rented
  await db
    .update(objectsTable)
    .set({ status: "rented" })
    .where(eq(objectsTable.id, assetId));

  res.status(201).json(await enrichRental(rental));
});

router.put("/:id", async (req, res) => {
  const { status, endDate } = req.body;
  const updates: Partial<typeof rentalsTable.$inferInsert> = {};
  if (status) updates.status = status;
  if (endDate) updates.endDate = new Date(endDate);

  const [updated] = await db
    .update(rentalsTable)
    .set(updates)
    .where(eq(rentalsTable.id, Number(req.params.id)))
    .returning();

  if (!updated) return res.status(404).json({ error: "Not found" });

  if (status === "ended") {
    await db
      .update(objectsTable)
      .set({ status: "available" })
      .where(eq(objectsTable.id, updated.assetId));
  }

  res.json(await enrichRental(updated));
});

export default router;
