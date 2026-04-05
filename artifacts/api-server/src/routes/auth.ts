import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { signToken, requireAuth, requireAdmin, JwtPayload } from "../middleware/auth";

const router = Router();

// POST /auth/login — public, issues JWT token
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: "İstifadəçi adı və şifrə tələb olunur" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
  if (!user) {
    res.status(401).json({ error: "İstifadəçi tapılmadı" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Şifrə yanlışdır" });
    return;
  }

  const payload: JwtPayload = {
    userId: user.id,
    username: user.username,
    role: user.role as "admin" | "sales",
    fullName: user.fullName,
  };
  const token = signToken(payload);

  res.json({
    token,
    user: { id: user.id, username: user.username, role: user.role, fullName: user.fullName },
  });
});

// GET /auth/me — verify current session token
router.get("/me", requireAuth, (req, res) => {
  const user = (req as any).user as JwtPayload;
  res.json({ id: user.userId, username: user.username, role: user.role, fullName: user.fullName });
});

// GET /auth/users — admin only
router.get("/users", requireAdmin, async (_req, res) => {
  const users = await db.select({
    id: usersTable.id,
    username: usersTable.username,
    role: usersTable.role,
    fullName: usersTable.fullName,
    createdAt: usersTable.createdAt,
  }).from(usersTable).orderBy(usersTable.createdAt);
  res.json(users);
});

// POST /auth/users — admin only: create user
router.post("/users", requireAdmin, async (req, res) => {
  const { username, password, role, fullName } = req.body;
  if (!username || !password || !role || !fullName) {
    res.status(400).json({ error: "Bütün sahələr tələb olunur" });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "Bu istifadəçi adı artıq mövcuddur" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db.insert(usersTable).values({ username, passwordHash, role, fullName }).returning();
  res.status(201).json({ id: user.id, username: user.username, role: user.role, fullName: user.fullName });
});

// DELETE /auth/users/:id — admin only
router.delete("/users/:id", requireAdmin, async (req, res) => {
  const currentUser = (req as any).user as JwtPayload;
  if (currentUser.userId === Number(req.params.id)) {
    res.status(400).json({ error: "Öz hesabınızı silə bilməzsiniz" });
    return;
  }
  await db.delete(usersTable).where(eq(usersTable.id, Number(req.params.id)));
  res.status(204).send();
});

// PUT /auth/users/:id/password — admin only: reset password
router.put("/users/:id/password", requireAdmin, async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6) {
    res.status(400).json({ error: "Şifrə ən az 6 simvol olmalıdır" });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, Number(req.params.id)));
  res.json({ success: true });
});

export default router;
