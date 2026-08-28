import { AppShell } from "@/components/app-shell";
import { DrugBrandForm } from "@/components/drug-brand-form";
import { LoadDrugCatalog } from "@/components/load-drug-catalog";
import { listManufacturersForPicker } from "@/lib/drug-brands";
import { requireHospitalPage } from "@/lib/front-desk";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function HospitalDrugBrandsPage() {
  const user = await requireHospitalPage();
  if (user.role !== "SUPER_ADMIN") redirect("/");

  const catalogSize = await prisma.drugCatalog.count();
  const manufacturerCount = await prisma.drugManufacturer.count();
  if (manufacturerCount === 0) {
    // First visit: build manufacturer index from catalog (one-time)
    await prisma.$executeRaw`
      INSERT INTO "DrugManufacturer" ("id", "name", "medicineCount", "searchText")
      SELECT
        'm' || md5("manufacturer"),
        "manufacturer",
        COUNT(*)::int,
        lower(regexp_replace(trim("manufacturer"), '\\s+', ' ', 'g'))
      FROM "DrugCatalog"
      WHERE "manufacturer" IS NOT NULL AND TRIM("manufacturer") <> ''
      GROUP BY "manufacturer"
      ON CONFLICT ("name") DO UPDATE SET
        "medicineCount" = EXCLUDED."medicineCount",
        "searchText" = EXCLUDED."searchText"
    `;
  }

  const selected = await prisma.hospitalDrugManufacturer.findMany({
    where: { hospitalId: user.hospitalId },
    include: { manufacturer: { select: { id: true, name: true, medicineCount: true } } },
    orderBy: { manufacturer: { name: "asc" } },
  });

  const suggestions = await listManufacturersForPicker("", 40);

  return (
    <AppShell title="Medicine brands">
      <p className="mb-6 max-w-3xl text-sm text-text-secondary">
        Choose which manufacturers appear in the doctor’s prescription autosuggest for this hospital.
        This is available for every hospital super admin and does not require the Pharmacy module.
        Top Indian brands are listed first; search to find others. Leave empty to allow the full catalog.
      </p>
      <LoadDrugCatalog initialCount={catalogSize} />
      <DrugBrandForm
        initialSelected={selected.map((row) => row.manufacturer)}
        initialSuggestions={suggestions}
      />
    </AppShell>
  );
}
