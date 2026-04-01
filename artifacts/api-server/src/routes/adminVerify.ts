import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import type { Response } from "express";

export async function verifyAdmin(
  username: string | undefined,
  password: string | undefined,
  res: Response
): Promise<boolean> {
  if (!username || !password) {
    res.status(401).json({ error: "İstifadəçi adı və şifrə tələb olunur" });
    return false;
  }
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username))
    .limit(1);
  if (!user || user.role !== "admin") {
    res.status(403).json({ error: "Yalnız admin bu əməliyyatı edə bilər" });
    return false;
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Şifrə yanlışdır" });
    return false;
  }
  return true;
}
