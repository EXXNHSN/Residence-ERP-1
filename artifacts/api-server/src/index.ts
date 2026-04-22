import "dotenv/config";
import app from "./app";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import bcrypt from "bcryptjs";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function seedDefaultUsers() {
  try {
    const existing = await db.select().from(usersTable).limit(1);
    if (existing.length === 0) {
      console.log("No users found, seeding default admin and sales users...");
      const adminHash = await bcrypt.hash("admin123", 10);
      const satisHash = await bcrypt.hash("satis123", 10);
      await db.insert(usersTable).values([
        { username: "admin", passwordHash: adminHash, role: "admin", fullName: "Administrator" },
        { username: "satis", passwordHash: satisHash, role: "sales", fullName: "Satış Meneceri" },
      ]);
      console.log("Default users created: admin / admin123, satis / satis123");
    }
  } catch (err) {
    console.error("Seed error:", err);
  }
}

app.listen(port, async () => {
  console.log(`Server listening on port ${port}`);
  await seedDefaultUsers();
});
