import Link from "next/link";
import { redirect } from "next/navigation";
import { MissingRecord } from "@/components/missing-record";
import { routeParam } from "@/lib/route-param";
import { AppShell } from "@/components/app-shell";
import { VisitPaymentForm } from "@/components/visit-payment-form";
import { SendPatientMessageButton } from "@/components/send-patient-message-button";
import { secondaryButtonClass } from "@/components/auth-shell";
import { canSendIssuedInvoice } from "@/lib/billing/rules";
import {
  consultationFeeForVisit,
  doctorName,
  hasBillingAccess,
  inr,
  patientName,
  prettyEnum,
  requireHospitalPage,
  tokenLabel,
} from "@/lib/front-desk";
import { invoiceWhatsAppSent } from "@/lib/messaging/whatsapp-sent";
import { prisma } from "@/lib/prisma";
import { isActingAsDoctor, resolveViewContext } from "@/lib/view-mode";

export default async function CollectVisitPaymentPage({
  params,
}: {
  params: Promise<{ appointmentId: string }>;
}) {
  const user = await requireHospitalPage();
  if (!hasBillingAccess(user)) redirect("/");
  const view = await resolveViewContext(user);
  const continueToVisit = user.role === "NURSE" || user.role === "DOCTOR" || isActingAsDoctor(user, view.mode);
  const appointmentId = await routeParam(params, "appointmentId");

  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, hospitalId: user.hospitalId },
    include: {
      patient: true,
      doctor: { include: { appUser: { select: { username: true, firstName: true, lastName: true } } } },
      department: true,
      hospital: { select: { opdFee: true } },
      invoices: {
        where: { status: { not: "VOID" } },
        orderBy: { issuedAt: "desc" },
        take: 1,
        include: { payments: true },
      },
    },
  });
  if (!appointment) {
    return <MissingRecord title="Record payment" backHref="/billing/collections" backLabel="Back to collections" />;
  }

  const invoice = appointment.invoices[0] ?? null;
  const defaultFee = consultationFeeForVisit({ ...appointment, hospital: appointment.hospital });
  const paid = invoice ? Number(invoice.paidAmount) : 0;
  const suggested = invoice && paid > 0 ? Math.max(0, Number(invoice.netTotal) - paid) : defaultFee;
  const due = suggested;
  const doctorLabel = doctorName(appointment.doctor);
  const billAlreadySent =
    invoice && canSendIssuedInvoice(invoice.status)
      ? await invoiceWhatsAppSent({
          hospitalId: user.hospitalId,
          invoiceNo: invoice.invoiceNo,
          appointmentId: appointment.id,
        })
      : false;

  const visitHref = `/appointments/${appointment.id}`;
  if (due <= 0) {
    redirect(continueToVisit ? visitHref : invoice ? `/billing/${invoice.id}` : visitHref);
  }

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
        {invoice && canSendIssuedInvoice(invoice.status) ? (
          <>
            <SendPatientMessageButton
              endpoint={`/api/invoices/${invoice.id}/send`}
              patientPhone={appointment.patient.phone}
              label="Send on WhatsApp"
              alreadySent={billAlreadySent}
            />
            <Link href={`/billing/${invoice.id}`} className={secondaryButtonClass}>
              View / print receipt
            </Link>
          </>
        ) : null}
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
            <dt className="text-xs uppercase tracking-wide text-slate-500">Default OPD amount</dt>
            <dd className="font-medium">{inr(defaultFee)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Already collected</dt>
            <dd className="font-medium">{inr(paid)}</dd>
          </div>
        </dl>
      </article>

      <VisitPaymentForm
        appointmentId={appointment.id}
        due={due > 0 ? due : defaultFee}
        doctorLabel={doctorLabel}
        afterPayHref={continueToVisit ? visitHref : undefined}
      />
    </AppShell>
  );
}
