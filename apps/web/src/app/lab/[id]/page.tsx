import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { LabWorkForm } from "@/components/lab-work-form";
import { secondaryButtonClass } from "@/components/auth-shell";
import { LAB_REPORT_VIEW_ROLES, LAB_VIEW_ROLES, LAB_WORK_ROLES, inr, patientName, requireHospitalPage } from "@/lib/front-desk";
import { prettyLabStatus } from "@/lib/lab-catalog";
import { prisma } from "@/lib/prisma";

export default async function LabOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireHospitalPage();
  const { id } = await params;
  const order = await prisma.labOrder.findFirst({
    where: { id, hospitalId: user.hospitalId },
    include: { patient: true, items: true },
  });
  if (!order) notFound();
  if (order.fulfillment === "EXTERNAL") {
    redirect(order.appointmentId ? `/appointments/${order.appointmentId}` : "/lab");
  }
  if (user.role === "DOCTOR" || user.role === "NURSE") redirect(`/patients/${order.patientId}`);
  if (!LAB_VIEW_ROLES.includes(user.role)) redirect("/");
  const canWork = LAB_WORK_ROLES.includes(user.role);
  const canViewReport = LAB_REPORT_VIEW_ROLES.includes(user.role);
  const isLabTech = user.role === "LAB_TECH";

  return (
    <AppShell title="Lab order">
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/lab" className={secondaryButtonClass}>
          Laboratory
        </Link>
        {!isLabTech && order.appointmentId ? (
          <Link href={`/appointments/${order.appointmentId}`} className={secondaryButtonClass}>
            Open visit
          </Link>
        ) : null}
        {!isLabTech ? (
          <Link href={`/patients/${order.patientId}`} className={secondaryButtonClass}>
            Patient file
          </Link>
        ) : null}
      </div>
      <section className="mb-6 max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold">{patientName(order.patient)}</h3>
        <p className="mt-1 text-sm text-slate-500">
          {prettyLabStatus(order.status)} · {inr(order.totalAmount)} · ordered by {order.orderedByUsername ?? "doctor"}
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
          {order.items.map((item) => (
            <li key={item.id}>{item.nameSnapshot}</li>
          ))}
        </ul>
      </section>
      {canWork && order.status !== "AWAITING_PAYMENT" ? (
        <LabWorkForm
          orderId={order.id}
          status={order.status}
          items={order.items.map((item) => ({ id: item.id, nameSnapshot: item.nameSnapshot }))}
          reportFileName={order.reportFileName}
        />
      ) : canViewReport && order.reportFileName && order.status === "RESULTED" ? (
        <p className="max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 text-sm">
          Report is on the patient record.{" "}
          <a className="font-medium text-teal-700 hover:underline" href={`/api/lab/orders/${order.id}/report`}>
            Open {order.reportFileName}
          </a>
        </p>
      ) : (
        <p className="max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
          {order.status === "AWAITING_PAYMENT"
            ? "Reception must collect payment before laboratory can work on this request."
            : "Lab report is pending."}
        </p>
      )}
    </AppShell>
  );
}
