import "dotenv/config";
import app from "./app";
import { db, pool } from "@workspace/db";
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

async function ensureCommunalBillsColumns() {
  try {
    await pool.query(`
      ALTER TABLE communal_bills ADD COLUMN IF NOT EXISTS custom_tariff numeric(10, 4);
      ALTER TABLE communal_bills ADD COLUMN IF NOT EXISTS carry_over numeric(12, 2) NOT NULL DEFAULT '0';
      ALTER TABLE communal_bills ADD COLUMN IF NOT EXISTS total_amount numeric(12, 2);
      UPDATE communal_bills SET total_amount = amount WHERE total_amount IS NULL;
    `);
    console.log("Communal bills schema verified/migrated.");
  } catch (err) {
    console.error("Migration error for communal_bills:", err);
  }
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
  await ensureCommunalBillsColumns();
  await seedDefaultUsers();
});
