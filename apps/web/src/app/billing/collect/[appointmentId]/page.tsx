import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { VisitPaymentForm } from "@/components/visit-payment-form";
import { secondaryButtonClass } from "@/components/auth-shell";
import {
  BILLING_ROLES,
  consultationFeeForVisit,
  doctorName,
  inr,
  patientName,
  prettyEnum,
  requireHospitalPage,
  tokenLabel,
} from "@/lib/front-desk";
import { prisma } from "@/lib/prisma";

export default async function CollectVisitPaymentPage({
  params,
}: {
  params: Promise<{ appointmentId: string }>;
}) {
  const user = await requireHospitalPage();
  if (!BILLING_ROLES.includes(user.role)) redirect("/");
  const { appointmentId } = await params;

  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, hospitalId: user.hospitalId },
    include: {
      patient: true,
      doctor: { include: { appUser: { select: { username: true } } } },
      department: true,
      hospital: { select: { opdFee: true } },
      invoices: { orderBy: { issuedAt: "desc" }, take: 1, include: { payments: true } },
    },
  });
  if (!appointment) notFound();

  const invoice = appointment.invoices[0] ?? null;
  const fee = invoice
    ? Number(invoice.netTotal)
    : consultationFeeForVisit({ ...appointment, hospital: appointment.hospital });
  const paid = invoice ? Number(invoice.paidAmount) : 0;
  const due = Math.max(0, fee - paid);
  const doctorLabel = doctorName(appointment.doctor);
  const amountLocked = Boolean(invoice);

  return (
    <AppShell title="Record payment">
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/queue" className={secondaryButtonClass}>
          OPD queue
        </Link>
        <Link href={`/appointments/${appointment.id}`} className={secondaryButtonClass}>
          Visit details
        </Link>
        <Link href="/billing/collections" className={secondaryButtonClass}>
          Doctor collections
        </Link>
      </div>

      <article className="mb-6 max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">
          {prettyEnum(appointment.queueType)} · Token {tokenLabel(appointment.tokenNumber)}
        </p>
        <h2 className="mt-1 text-xl font-semibold">{patientName(appointment.patient)}</h2>
        <p className="font-mono text-sm text-slate-500">{appointment.patient.mrn}</p>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Doctor</dt>
            <dd className="font-medium">{doctorLabel}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Department</dt>
            <dd className="font-medium">{appointment.department.name}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">OPD amount</dt>
            <dd className="font-medium">{inr(fee)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Balance due</dt>
            <dd className="font-medium">{inr(due)}</dd>
          </div>
        </dl>
      </article>

      {due <= 0 ? (
        <p className="max-w-3xl rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">
          This visit is already paid. Amount credited to {doctorLabel}: {inr(paid)}.
        </p>
      ) : (
        <VisitPaymentForm
          appointmentId={appointment.id}
          due={due}
          doctorLabel={doctorLabel}
          amountLocked={amountLocked}
        />
      )}
    </AppShell>
  );
}
