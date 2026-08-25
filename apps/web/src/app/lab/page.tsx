import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { FilterableTable } from "@/components/filterable-table";
import { LAB_VIEW_ROLES, LAB_WORK_ROLES, patientName, requireHospitalPage } from "@/lib/front-desk";
import { prettyLabStatus } from "@/lib/lab-catalog";
import { prisma } from "@/lib/prisma";

export default async function LabPage() {
  const user = await requireHospitalPage();
  if (user.role === "DOCTOR" || user.role === "NURSE") redirect("/patients");
  if (!LAB_VIEW_ROLES.includes(user.role)) redirect("/");

  const orders = await prisma.labOrder.findMany({
    where: {
      hospitalId: user.hospitalId,
      status: { in: LAB_WORK_ROLES.includes(user.role) ? ["PAID", "SAMPLE_COLLECTED", "RESULTED"] : ["PAID", "SAMPLE_COLLECTED", "RESULTED", "AWAITING_PAYMENT"] },
      fulfillment: "HOSPITAL_LAB",
    },
    orderBy: { updatedAt: "desc" },
    include: { patient: true, items: true },
    take: 80,
  });

  return (
    <AppShell title="Laboratory">
      <p className="mb-6 text-sm text-slate-500">
        Paid requests appear here. Upload the report and mark done. The doctor is notified; the file is on the patient record for the doctor and nurse.
      </p>
      <FilterableTable
        empty="No lab work in queue. Reception must collect payment first."
        minWidthClass="min-w-[48rem]"
        rows={orders.map((order) => ({
          id: order.id,
          patient: patientName(order.patient),
          tests: order.items.map((item) => item.nameSnapshot).join(", "),
          status: prettyLabStatus(order.status),
          when: (order.paidAt ?? order.createdAt).toLocaleString("en-IN"),
          href: `/lab/${order.id}`,
        }))}
        columns={[
          { key: "patient", header: "Patient", className: "font-medium", hrefKey: "href" },
          { key: "tests", header: "Tests" },
          { key: "status", header: "Status" },
          { key: "when", header: "Updated" },
        ]}
      />
    </AppShell>
  );
}
