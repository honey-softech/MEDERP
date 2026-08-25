import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { InvoiceAdjustments } from "@/components/billing-forms";
import { LabPaymentForm } from "@/components/lab-payment-form";
import { secondaryButtonClass } from "@/components/auth-shell";
import {
  BILLING_ROLES,
  FRONT_DESK_ROLES,
  WAIVER_APPROVER_ROLES,
  inr,
  patientName,
  requireHospitalPage,
} from "@/lib/front-desk";
import { ensureLabInvoice } from "@/lib/lab";
import { prisma } from "@/lib/prisma";

export default async function CollectLabPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireHospitalPage();
  if (!BILLING_ROLES.includes(user.role)) redirect("/");
  const { id } = await params;
  const order = await prisma.labOrder.findFirst({
    where: { id, hospitalId: user.hospitalId },
    include: { patient: true, items: true },
  });
  if (!order) notFound();
  if (order.fulfillment === "EXTERNAL") {
    redirect(order.appointmentId ? `/appointments/${order.appointmentId}` : "/billing/lab");
  }
  if (order.status !== "AWAITING_PAYMENT") {
    redirect(order.appointmentId ? `/appointments/${order.appointmentId}` : "/billing/lab");
  }

  const hospital = user.hospital ?? (await prisma.hospital.findUnique({ where: { id: user.hospitalId } }));
  if (!hospital) notFound();
  const invoice = await ensureLabInvoice({
    orderId: order.id,
    hospitalId: user.hospitalId,
    hospitalCode: hospital.code,
  });
  if (!invoice) notFound();

  const due = Math.max(0, Number(invoice.netTotal) - Number(invoice.paidAmount));
  const waiverApproved = invoice.waiverStatus === "APPROVED" && Number(invoice.waiverAmount) > 0;

  return (
    <AppShell title="Collect lab payment">
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/billing/lab" className={secondaryButtonClass}>
          Lab collections
        </Link>
        {order.appointmentId ? (
          <Link href={`/appointments/${order.appointmentId}`} className={secondaryButtonClass}>
            Visit details
          </Link>
        ) : null}
      </div>
      <article className="mb-6 max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold">{patientName(order.patient)}</h2>
        <p className="font-mono text-sm text-slate-500">{order.patient.mrn}</p>
        <p className="mt-2 text-sm text-slate-600">{order.items.map((item) => item.nameSnapshot).join(", ")}</p>
        <dl className="mt-4 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt>Tests</dt>
            <dd>{inr(invoice.subtotal)}</dd>
          </div>
          {Number(invoice.discountAmount) > 0 ? (
            <div className="flex justify-between">
              <dt>Discount</dt>
              <dd>- {inr(invoice.discountAmount)}</dd>
            </div>
          ) : null}
          {waiverApproved ? (
            <div className="flex justify-between">
              <dt>Waiver{invoice.waiverReason ? ` · ${invoice.waiverReason}` : ""}</dt>
              <dd>- {inr(invoice.waiverAmount)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between font-semibold">
            <dt>Balance due</dt>
            <dd>{inr(due)}</dd>
          </div>
        </dl>
      </article>

      <div className="mb-6 max-w-3xl">
        <InvoiceAdjustments
          invoiceId={invoice.id}
          paid={Number(invoice.paidAmount)}
          canApproveWaiver={WAIVER_APPROVER_ROLES.includes(user.role)}
          canRequestWaiver={FRONT_DESK_ROLES.includes(user.role)}
          waiverStatus={invoice.waiverStatus}
        />
      </div>

      <LabPaymentForm
        orderId={order.id}
        due={due}
        tests={order.items.map((item) => item.nameSnapshot)}
      />
    </AppShell>
  );
}
