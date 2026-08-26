import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { InvoiceActions } from "@/components/billing-forms";
import { PrintButton } from "@/components/print-button";
import { secondaryButtonClass } from "@/components/auth-shell";
import { BILLING_ROLES, FRONT_DESK_ROLES, WAIVER_APPROVER_ROLES, doctorName, inr, patientName, prettyEnum, requireHospitalPage } from "@/lib/front-desk";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireHospitalPage();
  if (!BILLING_ROLES.includes(user.role)) redirect("/");
  const { id } = await params;
  const invoice = await prisma.invoice.findFirst({
    where: { id, hospitalId: user.hospitalId },
    include: {
      patient: true,
      items: true,
      payments: { orderBy: { receivedAt: "desc" } },
      appointment: { include: { doctor: { include: { appUser: { select: { username: true } } } }, department: true } },
    },
  });
  if (!invoice) notFound();

  const due = Math.max(0, Number(invoice.netTotal) - Number(invoice.paidAmount));

  return (
    <AppShell title={invoice.invoiceNo}>
      <div className="mb-6 flex flex-wrap items-center gap-3 print:hidden">
        <Link href="/billing" className={secondaryButtonClass}>
          Back
        </Link>
        <PrintButton />
      </div>

      <article className="max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">
          {user.hospital?.name ?? "Hospital"}
        </p>
        <h2 className="mt-1 text-xl font-semibold">Receipt / invoice</h2>
        <p className="mt-1 text-sm text-slate-500">
          {invoice.issuedAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} · {prettyEnum(invoice.status)}
        </p>
        <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <p>
            <span className="text-slate-500">Patient</span>
            <br />
            <Link className="font-medium text-teal-700 hover:underline" href={`/patients/${invoice.patientId}`}>
              {patientName(invoice.patient)}
            </Link>{" "}
            · {invoice.patient.mrn}
          </p>
          {invoice.appointment ? (
            <p>
              <span className="text-slate-500">Visit</span>
              <br />
              {doctorName(invoice.appointment.doctor)} · {invoice.appointment.department.name}
            </p>
          ) : null}
        </div>
        <table className="mt-6 w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="py-2">Item</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item) => (
              <tr key={item.id} className="border-t border-slate-100">
                <td className="py-2">{item.description}</td>
                <td className="py-2 text-right">{inr(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="mt-4 space-y-1 text-sm">
          {Number(invoice.discountAmount) > 0 || (invoice.waiverStatus === "APPROVED" && Number(invoice.waiverAmount) > 0) ? (
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd>{inr(invoice.subtotal)}</dd>
            </div>
          ) : null}
          {Number(invoice.discountAmount) > 0 ? (
            <div className="flex justify-between">
              <dt>Discount</dt>
              <dd>- {inr(invoice.discountAmount)}</dd>
            </div>
          ) : null}
          {invoice.waiverStatus === "APPROVED" && Number(invoice.waiverAmount) > 0 ? (
            <div className="flex justify-between">
              <dt>Waiver{invoice.waiverReason ? ` · ${invoice.waiverReason}` : ""}</dt>
              <dd>- {inr(invoice.waiverAmount)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between font-semibold">
            <dt>Total</dt>
            <dd>{inr(invoice.netTotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Paid</dt>
            <dd>{inr(invoice.paidAmount)}</dd>
          </div>
          {due > 0 ? (
            <div className="flex justify-between">
              <dt>Balance due</dt>
              <dd>{inr(due)}</dd>
            </div>
          ) : null}
        </dl>
        {invoice.payments.length > 0 ? (
          <div className="mt-6 border-t border-slate-100 pt-4">
            <h3 className="text-sm font-medium">Payments</h3>
            <ul className="mt-2 space-y-1 text-sm text-slate-600">
              {invoice.payments.map((payment) => (
                <li key={payment.id}>
                  {payment.receivedAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} · {prettyEnum(payment.kind)} · {prettyEnum(payment.method)} · {inr(payment.amount)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </article>

      <div className="mt-8 max-w-3xl print:hidden">
        <InvoiceActions
          invoiceId={invoice.id}
          due={due}
          paid={Number(invoice.paidAmount)}
          canApproveWaiver={WAIVER_APPROVER_ROLES.includes(user.role)}
          canRequestWaiver={FRONT_DESK_ROLES.includes(user.role)}
          waiverStatus={invoice.waiverStatus}
          fullPaymentRequired={Boolean(invoice.appointmentId)}
        />
      </div>
    </AppShell>
  );
}
