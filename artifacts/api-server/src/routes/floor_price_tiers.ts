import { Router } from "express";
import { db } from "@workspace/db";
import { floorPriceTiersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { verifyAdmin } from "./adminVerify";

const router = Router();

router.get("/", async (_req, res) => {
  const tiers = await db
    .select()
    .from(floorPriceTiersTable)
    .orderBy(floorPriceTiersTable.floorFrom);
  res.json(tiers.map((t) => ({ ...t, pricePerSqm: Number(t.pricePerSqm) })));
});

router.post("/", async (req, res) => {
  const { username, password, floorFrom, floorTo, pricePerSqm } = req.body;
  const adminErr = await verifyAdmin(username, password);
  if (adminErr) return res.status(401).json({ error: adminErr });

  if (!floorFrom || !floorTo || !pricePerSqm) {
    return res.status(400).json({ error: "Bütün sahələr doldurulmalıdır" });
  }
  if (Number(floorFrom) > Number(floorTo)) {
    return res.status(400).json({ error: "Başlanğıc mərtəbə son mərtəbədən böyük ola bilməz" });
  }

  const [tier] = await db
    .insert(floorPriceTiersTable)
    .values({ floorFrom: Number(floorFrom), floorTo: Number(floorTo), pricePerSqm: String(pricePerSqm) })
    .returning();

  res.json({ ...tier, pricePerSqm: Number(tier.pricePerSqm) });
});

router.put("/:id", async (req, res) => {
  const { username, password, floorFrom, floorTo, pricePerSqm } = req.body;
  const adminErr = await verifyAdmin(username, password);
  if (adminErr) return res.status(401).json({ error: adminErr });

  const [updated] = await db
    .update(floorPriceTiersTable)
    .set({ floorFrom: Number(floorFrom), floorTo: Number(floorTo), pricePerSqm: String(pricePerSqm) })
    .where(eq(floorPriceTiersTable.id, Number(req.params.id)))
    .returning();

  if (!updated) return res.status(404).json({ error: "Tapılmadı" });
  res.json({ ...updated, pricePerSqm: Number(updated.pricePerSqm) });
});

router.delete("/:id", async (req, res) => {
  const { username, password } = req.body;
  const adminErr = await verifyAdmin(username, password);
  if (adminErr) return res.status(401).json({ error: adminErr });

  await db.delete(floorPriceTiersTable).where(eq(floorPriceTiersTable.id, Number(req.params.id)));
  res.json({ ok: true });
});

export default router;
