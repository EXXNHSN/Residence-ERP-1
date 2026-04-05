import { Router } from "express";
import { db } from "@workspace/db";
import { customersTable, rentalsTable, objectsTable } from "@workspace/db/schema";
import { eq, and, or, isNull } from "drizzle-orm";

const router = Router();

// GET /renters — all "object" (qeyri yaşayış) renters
// Includes both customer-linked rentals and tenant-name-only rentals
router.get("/", async (req, res) => {
  // Fetch all object-type rentals with optional customer and object joins
  const rows = await db
    .select({
      rental: rentalsTable,
      customer: customersTable,
      object: objectsTable,
    })
    .from(rentalsTable)
    .leftJoin(customersTable, eq(rentalsTable.customerId, customersTable.id))
    .leftJoin(objectsTable, eq(rentalsTable.assetId, objectsTable.id))
    .where(eq(rentalsTable.assetType, "object"))
    .orderBy(rentalsTable.startDate);

  // Build a unified renter list.
  // - Rentals with customerId: group under that customer
  // - Rentals without customerId: each becomes its own pseudo-renter using tenantName/Phone/Fin

  const customerMap = new Map<number, any>();
  const standaloneRenters: any[] = [];

  for (const row of rows) {
    const rentalEntry = {
      id: row.rental.id,
      assetId: row.rental.assetId,
      assetType: row.rental.assetType,
      monthlyAmount: Number(row.rental.monthlyAmount),
      startDate: row.rental.startDate.toISOString(),
      endDate: row.rental.endDate.toISOString(),
      status: row.rental.status,
      contractNumber: row.rental.contractNumber,
      objectNumber: row.object?.number ?? null,
      objectType: row.object?.type ?? "object",
    };

    if (row.rental.customerId && row.customer) {
      const cid = row.customer.id;
      if (!customerMap.has(cid)) {
        customerMap.set(cid, {
          id: cid,
          customerId: cid,
          firstName: row.customer.firstName,
          lastName: row.customer.lastName,
          phone: row.customer.phone,
          fin: row.customer.fin ?? null,
          address: row.customer.address ?? null,
          isCustomer: true,
          rentals: [],
        });
      }
      customerMap.get(cid).rentals.push(rentalEntry);
    } else {
      // Tenant-only rental (no customer account)
      standaloneRenters.push({
        id: `rental-${row.rental.id}`,
        customerId: null,
        firstName: row.rental.tenantName?.split(" ")[0] ?? "İsimsiz",
        lastName: row.rental.tenantName?.split(" ").slice(1).join(" ") ?? "",
        phone: row.rental.tenantPhone ?? null,
        fin: row.rental.tenantFin ?? null,
        address: null,
        isCustomer: false,
        rentals: [rentalEntry],
      });
    }
  }

  const result = [
    ...Array.from(customerMap.values()),
    ...standaloneRenters,
  ];

  // Sort: active rentals first, then by name
  result.sort((a, b) => {
    const aActive = a.rentals.some((r: any) => r.status === "active");
    const bActive = b.rentals.some((r: any) => r.status === "active");
    if (aActive !== bActive) return aActive ? -1 : 1;
    return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`);
  });

  res.json(result);
});

export default router;
