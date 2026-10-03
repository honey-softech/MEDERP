import { AppShell } from "@/components/app-shell";
import { DrugBrandForm } from "@/components/drug-brand-form";
import { listManufacturersForPicker, listPreferredManufacturers } from "@/lib/drug-brands";
import { requireHospitalPage } from "@/lib/front-desk";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function DrugBrandsPage() {
  const user = await requireHospitalPage();
  if (user.role !== "SUPER_ADMIN") redirect("/");

  const catalogSize = await prisma.drugCatalog.count();
  const manufacturerCount = await prisma.drugManufacturer.count();
  if (manufacturerCount === 0 && catalogSize > 0) {
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

  const [selected, suggestions] = await Promise.all([
    listPreferredManufacturers(user.hospitalId),
    listManufacturersForPicker("", 40),
  ]);

  return (
    <AppShell title="Medicine brands">
      <p className="mb-6 max-w-3xl text-sm text-text-secondary">
        Choose preferred manufacturers for prescription search. Preferred brands appear first when doctors type a
        medicine name. Doctors can also star a manufacturer from the prescription search. Leave empty to rank the full
        catalog by match quality. Loading new medicines onto the server is done by MedERP software admin, not from here.
      </p>
      {catalogSize === 0 ? (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">
          The medicine catalog is empty on this server. Ask MedERP support or software admin to import it from{" "}
          <span className="font-medium">Medicine catalog</span> in the SaaS console.
        </p>
      ) : (
        <p className="mb-4 text-sm text-text-secondary">
          Medicine catalog: <span className="font-medium text-text-primary">{catalogSize.toLocaleString("en-IN")}</span>{" "}
          drugs available on this server.
        </p>
      )}
      <DrugBrandForm
        initialSelected={selected.map((row) => ({
          id: row.id,
          name: row.name,
          medicineCount: row.medicineCount,
        }))}
        initialSuggestions={suggestions}
      />
    </AppShell>
  );
}
