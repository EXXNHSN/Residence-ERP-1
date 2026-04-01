import { Router } from "express";
import { db } from "@workspace/db";
import { quartersTable, buildingsTable, blocksTable, apartmentsTable, usersTable } from "@workspace/db/schema";
import { eq, inArray, count } from "drizzle-orm";
import bcrypt from "bcryptjs";

const router = Router();

router.get("/", async (_req, res) => {
  const quarters = await db
    .select({ id: quartersTable.id, name: quartersTable.name, description: quartersTable.description, createdAt: quartersTable.createdAt })
    .from(quartersTable)
    .orderBy(quartersTable.name);

  const buildings = await db.select().from(buildingsTable);
  const blocks = await db.select().from(blocksTable);
  const aptCounts = await db.select({ blockId: apartmentsTable.blockId, cnt: count() }).from(apartmentsTable).groupBy(apartmentsTable.blockId);
  const aptMap = Object.fromEntries(aptCounts.map((c) => [c.blockId, Number(c.cnt)]));

  const result = quarters.map((q) => {
    const qBuildings = buildings.filter((b) => b.quarterId === q.id);
    const qBlocks = blocks.filter((bl) => qBuildings.some((b) => b.id === bl.buildingId) || bl.quarterId === q.id);
    const apartmentCount = qBlocks.reduce((s, bl) => s + (aptMap[bl.id] ?? 0), 0);
    return { ...q, buildingCount: qBuildings.length, apartmentCount };
  });

  res.json(result);
});

router.post("/", async (req, res) => {
  const { name, description } = req.body;
  const [quarter] = await db.insert(quartersTable).values({ name, description }).returning();
  res.status(201).json({ ...quarter, buildingCount: 0, apartmentCount: 0 });
});

// Cascade delete: apartments → blocks → buildings → quarter
// Requires password confirmation in request body
router.delete("/:id", async (req, res) => {
  const { username, password } = req.body ?? {};

  if (!username || !password) {
    return res.status(401).json({ error: "İstifadəçi adı və şifrə tələb olunur" });
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
  if (!user || user.role !== "admin") {
    return res.status(403).json({ error: "Yalnız admin bu əməliyyatı edə bilər" });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Şifrə yanlışdır" });
  }

  const quarterId = Number(req.params.id);

  // 1. Get all buildings in this quarter
  const buildings = await db.select({ id: buildingsTable.id }).from(buildingsTable).where(eq(buildingsTable.quarterId, quarterId));
  const buildingIds = buildings.map((b) => b.id);

  // 2. Get all blocks (by buildingId or direct quarterId)
  const blocksByBuilding = buildingIds.length > 0
    ? await db.select({ id: blocksTable.id }).from(blocksTable).where(inArray(blocksTable.buildingId, buildingIds))
    : [];
  const blocksByQuarter = await db.select({ id: blocksTable.id }).from(blocksTable).where(eq(blocksTable.quarterId, quarterId));
  const allBlockIds = [...new Set([...blocksByBuilding.map((b) => b.id), ...blocksByQuarter.map((b) => b.id)])];

  // 3. Delete apartments
  if (allBlockIds.length > 0) {
    await db.delete(apartmentsTable).where(inArray(apartmentsTable.blockId, allBlockIds));
  }

  // 4. Delete blocks
  if (allBlockIds.length > 0) {
    await db.delete(blocksTable).where(inArray(blocksTable.id, allBlockIds));
  }

  // 5. Delete buildings
  if (buildingIds.length > 0) {
    await db.delete(buildingsTable).where(inArray(buildingsTable.id, buildingIds));
  }

  // 6. Delete quarter
  await db.delete(quartersTable).where(eq(quartersTable.id, quarterId));

  res.status(204).send();
});

export default router;
