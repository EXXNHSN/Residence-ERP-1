import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

const router = Router();

router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Username and password required" });

  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
  if (!user) return res.status(401).json({ error: "İstifadəçi tapılmadı" });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Şifrə yanlışdır" });

  res.json({ id: user.id, username: user.username, role: user.role, fullName: user.fullName });
});

router.get("/users", async (_req, res) => {
  const users = await db.select({
    id: usersTable.id,
    username: usersTable.username,
    role: usersTable.role,
    fullName: usersTable.fullName,
    createdAt: usersTable.createdAt,
  }).from(usersTable).orderBy(usersTable.createdAt);
  res.json(users);
});

router.post("/users", async (req, res) => {
  const { username, password, role, fullName } = req.body;
  if (!username || !password || !role || !fullName)
    return res.status(400).json({ error: "Bütün sahələr tələb olunur" });

  const existing = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
  if (existing.length > 0) return res.status(409).json({ error: "Bu istifadəçi adı artıq mövcuddur" });

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db.insert(usersTable).values({ username, passwordHash, role, fullName }).returning();
  res.status(201).json({ id: user.id, username: user.username, role: user.role, fullName: user.fullName });
});

router.delete("/users/:id", async (req, res) => {
  await db.delete(usersTable).where(eq(usersTable.id, Number(req.params.id)));
  res.status(204).send();
});

export default router;
