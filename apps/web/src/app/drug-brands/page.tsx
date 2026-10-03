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

  const manufacturerLabel = manufacturerCount.toLocaleString("en-IN");
  const catalogLabel = catalogSize.toLocaleString("en-IN");

  return (
    <AppShell title="Medicine brands">
      <div className="mb-6 space-y-4">
        <p className="max-w-3xl text-sm text-text-secondary">
          Select the manufacturers this hospital usually stocks. Those brands appear first when a doctor searches
          medicines while writing a prescription.
        </p>

        {catalogSize === 0 ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">
            The medicine catalog is empty on this server. Ask MedERP support or software admin to import it from{" "}
            <span className="font-medium">Medicine catalog</span> in the SaaS console.
          </p>
        ) : (
          <p className="text-sm text-text-secondary">
            Catalog on this server:{" "}
            <span className="font-medium text-text-primary">{catalogLabel}</span> drugs ·{" "}
            <span className="font-medium text-text-primary">{manufacturerLabel}</span> manufacturers
          </p>
        )}

        <section className="rounded-lg border border-border bg-surface p-4 shadow-card">
          <h2 className="text-sm font-semibold text-text-primary">How prescription drug search works</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Doctors never browse the full catalog. They type a medicine name or salt (for example{" "}
            <span className="font-medium text-text-primary">Paracetamol 500</span>) and get a short ranked list.
          </p>

          <ol className="mt-4 space-y-3 text-sm text-text-secondary">
            <li className="flex gap-3">
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-light text-xs font-semibold text-primary-dark">
                1
              </span>
              <div>
                <p className="font-medium text-text-primary">Preferred manufacturers first</p>
                <p className="mt-0.5">
                  Brands you select here show under <span className="font-medium text-text-primary">Preferred</span> in
                  the search dropdown. Order of selection is used as priority (earlier = higher).
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-light text-xs font-semibold text-primary-dark">
                2
              </span>
              <div>
                <p className="font-medium text-text-primary">Other brands still available</p>
                <p className="mt-0.5">
                  Matching medicines from other manufacturers appear under{" "}
                  <span className="font-medium text-text-primary">Other results</span>. Preferred brands are never a hard
                  lock unless the doctor filters to “Preferred only”.
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-light text-xs font-semibold text-primary-dark">
                3
              </span>
              <div>
                <p className="font-medium text-text-primary">Filters while searching</p>
                <p className="mt-0.5">
                  Doctors can narrow by manufacturer, dosage form (tablet, syrup…), and strength (500mg). Searching{" "}
                  <span className="font-medium text-text-primary">Paracetamol 500 tablet</span> uses those hints
                  automatically.
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-light text-xs font-semibold text-primary-dark">
                4
              </span>
              <div>
                <p className="font-medium text-text-primary">Quick-add with ☆</p>
                <p className="mt-0.5">
                  From prescription search, a doctor or super admin can tap ☆ on a result to add that manufacturer to
                  this preferred list without opening this page.
                </p>
              </div>
            </li>
          </ol>

          <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
            <div className="rounded-md bg-app-bg px-3 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Recommended</p>
              <p className="mt-1 text-sm text-text-primary">
                Pick about <span className="font-semibold">10–50</span> manufacturers you commonly purchase. Leave the
                list empty only if you want the full catalog ranked with no brand preference.
              </p>
            </div>
            <div className="rounded-md bg-app-bg px-3 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Example</p>
              <p className="mt-1 text-sm text-text-primary">
                Prefer Micro Labs + Cipla → doctor types “dolo” →{" "}
                <span className="font-semibold">Dolo 650 (Micro Labs)</span> appears first, then other matches.
              </p>
            </div>
          </div>

          <p className="mt-3 text-xs text-text-secondary">
            Importing or updating the national medicine catalog is done by MedERP software admin, not from this page.
          </p>
        </section>
      </div>

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
