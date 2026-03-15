import { Router } from "express";
import { db } from "@workspace/db";
import { internetSubscriptionsTable, customersTable, apartmentsTable, objectsTable, blocksTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

async function enrichSubscription(sub: typeof internetSubscriptionsTable.$inferSelect) {
  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, sub.customerId));

  let assetDescription = `#${sub.assetId}`;
  if (sub.assetType === "apartment") {
    const [row] = await db
      .select({ apt: apartmentsTable, blockName: blocksTable.name })
      .from(apartmentsTable)
      .leftJoin(blocksTable, eq(apartmentsTable.blockId, blocksTable.id))
      .where(eq(apartmentsTable.id, sub.assetId));
    if (row) assetDescription = `${row.blockName} - Mənzil ${row.apt.number}`;
  } else {
    const [obj] = await db.select().from(objectsTable).where(eq(objectsTable.id, sub.assetId));
    if (obj) assetDescription = `${obj.type === "garage" ? "Qaraj" : "Obyekt"} ${obj.number}`;
  }

  const expiryDate = new Date(sub.expiryDate);
  const now = new Date();
  const daysRemaining = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  return {
    id: sub.id,
    assetType: sub.assetType,
    assetId: sub.assetId,
    assetDescription,
    ownerName: customer ? `${customer.firstName} ${customer.lastName}` : "",
    packageName: sub.packageName,
    monthlyPrice: Number(sub.monthlyPrice),
    startDate: sub.startDate.toISOString(),
    expiryDate: sub.expiryDate.toISOString(),
    status: sub.status,
    daysRemaining,
  };
}

router.get("/", async (req, res) => {
  const { status } = req.query;
  let query = db.select().from(internetSubscriptionsTable).$dynamic();
  if (status) query = query.where(eq(internetSubscriptionsTable.status, status as string));

  const subs = await query.orderBy(internetSubscriptionsTable.expiryDate);
  res.json(await Promise.all(subs.map(enrichSubscription)));
});

router.post("/", async (req, res) => {
  const { assetType, assetId, customerId, packageName, monthlyPrice, startDate } = req.body;
  const start = new Date(startDate);
  const expiry = new Date(start);
  expiry.setMonth(expiry.getMonth() + 1);

  const [sub] = await db
    .insert(internetSubscriptionsTable)
    .values({
      assetType,
      assetId,
      customerId,
      packageName,
      monthlyPrice: String(monthlyPrice),
      startDate: start,
      expiryDate: expiry,
      status: "active",
    })
    .returning();

  res.status(201).json(await enrichSubscription(sub));
});

router.post("/:id/pay", async (req, res) => {
  const [sub] = await db
    .select()
    .from(internetSubscriptionsTable)
    .where(eq(internetSubscriptionsTable.id, Number(req.params.id)));

  if (!sub) return res.status(404).json({ error: "Not found" });

  const newExpiry = new Date(sub.expiryDate);
  newExpiry.setMonth(newExpiry.getMonth() + 1);

  const [updated] = await db
    .update(internetSubscriptionsTable)
    .set({ expiryDate: newExpiry, status: "active" })
    .where(eq(internetSubscriptionsTable.id, sub.id))
    .returning();

  res.json(await enrichSubscription(updated));
});

export default router;
