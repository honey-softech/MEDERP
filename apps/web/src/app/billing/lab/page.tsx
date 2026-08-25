import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { FilterableTable } from "@/components/filterable-table";
import { BILLING_ROLES, inr, patientName, requireHospitalPage } from "@/lib/front-desk";
import { prettyLabStatus } from "@/lib/lab-catalog";
import { prisma } from "@/lib/prisma";

export default async function LabCollectionsPage() {
  const user = await requireHospitalPage();
  if (!BILLING_ROLES.includes(user.role)) redirect("/");

  const orders = await prisma.labOrder.findMany({
    where: { hospitalId: user.hospitalId, status: { not: "CANCELLED" }, fulfillment: "HOSPITAL_LAB" },
    orderBy: { createdAt: "desc" },
    include: { patient: true, items: true },
    take: 80,
  });

  return (
    <AppShell title="Lab collections">
      <p className="mb-6 text-sm text-slate-500">
        Doctor-ordered tests wait here until reception collects the amount. After payment, laboratory is notified.
      </p>
      <FilterableTable
        empty="No lab orders yet."
        minWidthClass="min-w-[48rem]"
        rows={orders.map((order) => ({
          id: order.id,
          patient: patientName(order.patient),
          tests: String(order.items.length),
          amount: inr(order.totalAmount),
          status: prettyLabStatus(order.status),
          when: order.createdAt.toLocaleString("en-IN"),
          href: order.status === "AWAITING_PAYMENT" ? `/billing/lab/${order.id}` : `/appointments/${order.appointmentId ?? ""}`,
        }))}
        columns={[
          { key: "patient", header: "Patient", className: "font-medium", hrefKey: "href" },
          { key: "tests", header: "Tests" },
          { key: "amount", header: "Amount" },
          { key: "status", header: "Status" },
          { key: "when", header: "Ordered" },
        ]}
      />
      <p className="mt-4 text-sm">
        <Link href="/lab" className="font-medium text-teal-700 hover:underline">
          Open laboratory queue
        </Link>
      </p>
    </AppShell>
  );
}
