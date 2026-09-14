import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AddMedicineForm } from "@/components/add-medicine-form";
import { LoadDrugCatalog } from "@/components/load-drug-catalog";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function MedicineCatalogPage() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "SOFTWARE_ADMIN" && user.role !== "HELPDESK")) {
    redirect("/login");
  }

  const [catalogSize, manufacturerCount, recent] = await Promise.all([
    prisma.drugCatalog.count(),
    prisma.drugManufacturer.count(),
    prisma.drugCatalog.findMany({
      where: { sourceId: { gte: 9_000_000 } },
      orderBy: { sourceId: "desc" },
      take: 15,
      select: {
        id: true,
        name: true,
        manufacturer: true,
        saltComposition: true,
        packSize: true,
        type: true,
        sourceId: true,
      },
    }),
  ]);

  return (
    <AppShell title="Medicine catalog">
      <p className="mb-6 max-w-3xl text-sm text-slate-500">
        Server-wide medicine list used for prescription search. Only software admin and helpdesk can import or add
        medicines. Hospital admins only choose preferred brands for their hospital.
      </p>

      <LoadDrugCatalog initialCount={catalogSize} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Medicines in catalog</p>
          <p className="mt-1 text-2xl font-semibold">{catalogSize.toLocaleString("en-IN")}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Manufacturers</p>
          <p className="mt-1 text-2xl font-semibold">{manufacturerCount.toLocaleString("en-IN")}</p>
        </article>
      </div>

      <div className="mb-8">
        <AddMedicineForm />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h3 className="font-semibold">Recently added manually</h3>
        <p className="mt-1 text-sm text-slate-500">Medicines added outside the bulk import (source id ≥ 9,000,000).</p>
        {recent.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No manually added medicines yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {recent.map((row) => (
              <li key={row.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <div>
                  <p className="font-medium text-slate-900">{row.name}</p>
                  <p className="text-xs text-slate-500">
                    {[row.manufacturer, row.saltComposition, row.packSize, row.type].filter(Boolean).join(" · ") ||
                      "No extra details"}
                  </p>
                </div>
                <span className="font-mono text-xs text-slate-400">#{row.sourceId}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
