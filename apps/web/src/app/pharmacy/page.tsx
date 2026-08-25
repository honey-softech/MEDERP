import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { FilterableTable } from "@/components/filterable-table";
import { primaryButtonClass, secondaryButtonClass } from "@/components/auth-shell";
import { PHARMACY_ROLES, listPharmacyInventory } from "@/lib/pharmacy";
import { requireHospitalPage } from "@/lib/front-desk";

export default async function PharmacyPage() {
  const user = await requireHospitalPage();
  if (user.role === "DOCTOR" || user.role === "NURSE") redirect("/");
  if (!PHARMACY_ROLES.includes(user.role)) redirect("/");

  const inventory = await listPharmacyInventory(user.hospitalId);
  const low = inventory.filter((row) => row.lowStock).length;
  const near = inventory.filter((row) => row.expiringIn30).length;

  return (
    <AppShell title="Pharmacy">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-text-secondary">
            Batch-level stock. Low stock: {low} · Expiring in 30 days: {near}
          </p>
        </div>
        <Link href="/pharmacy/stock-in" className={primaryButtonClass}>
          Stock in (GRN)
        </Link>
        <Link href="/pharmacy/prescriptions" className={secondaryButtonClass}>
          Prescription billing
        </Link>
      </div>
      <FilterableTable
        empty="No medicines in inventory yet. Use Stock in (GRN) to receive the first batch."
        searchPlaceholder="Search medicine…"
        rows={inventory.map((row) => ({
          id: row.id,
          name: row.name,
          salt: row.genericName ?? "—",
          manufacturer: row.manufacturer ?? "—",
          stock: String(row.stock),
          batches: String(row.batchCount),
          reorder: String(row.reorderLevel),
          flags: [row.lowStock ? "Low" : "", row.expiringIn30 ? "≤30d" : row.nearExpiry ? "≤90d" : "", row.expired ? "Expired" : ""]
            .filter(Boolean)
            .join(" · ") || "—",
          barcode: row.barcode ?? "—",
        }))}
        columns={[
          { key: "name", header: "Medicine", className: "font-medium" },
          { key: "salt", header: "Salt" },
          { key: "manufacturer", header: "Manufacturer" },
          { key: "stock", header: "Stock" },
          { key: "batches", header: "Batches" },
          { key: "reorder", header: "Reorder at" },
          { key: "flags", header: "Alerts" },
          { key: "barcode", header: "Barcode", className: "font-mono text-xs" },
        ]}
      />
    </AppShell>
  );
}
