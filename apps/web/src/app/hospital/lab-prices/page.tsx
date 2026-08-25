import { AppShell } from "@/components/app-shell";
import { LabPriceForm } from "@/components/lab-price-form";
import { requireHospitalPage } from "@/lib/front-desk";
import { syncLabCatalog } from "@/lib/lab";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function HospitalLabPricesPage() {
  const user = await requireHospitalPage();
  if (user.role !== "SUPER_ADMIN") redirect("/");
  await syncLabCatalog();

  const tests = await prisma.labTest.findMany({
    where: { isActive: true, kind: "BLOOD" },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { hospitalPrices: { where: { hospitalId: user.hospitalId } } },
  });

  return (
    <AppShell title="Lab test prices">
      <p className="mb-6 max-w-3xl text-sm text-slate-500">
        Set what reception collects when a doctor orders these blood tests. Laboratory only sees the request after
        payment. Scan prices can be added later on the same screen.
      </p>
      <LabPriceForm
        initial={tests.map((test) => ({
          id: test.id,
          code: test.code,
          name: test.name,
          category: test.category,
          description: test.description,
          defaultPrice: Number(test.price),
          price: Number(test.hospitalPrices[0]?.price ?? test.price),
          isOffered: test.hospitalPrices[0]?.isOffered ?? true,
        }))}
      />
    </AppShell>
  );
}
