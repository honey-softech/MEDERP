import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { primaryButtonClass, secondaryButtonClass } from "@/components/auth-shell";
import { VitalsForm } from "@/components/vitals-form";
import { isConsultationPaid } from "@/lib/billing/rules";
import {
  NURSE_VITALS_ROLES,
  canNurseRecordVitals,
  patientName,
  requireHospitalPage,
  tokenLabel,
} from "@/lib/front-desk";
import { prisma } from "@/lib/prisma";
import { toVitalsValues } from "@/lib/vitals";

export default async function UpdateVitalsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireHospitalPage();
  const { id } = await params;
  const appointment = await prisma.appointment.findFirst({
    where: { id, hospitalId: user.hospitalId },
    include: {
      patient: true,
      doctor: { select: { appUserId: true } },
      vitals: true,
      invoices: {
        where: { status: { not: "VOID" } },
        orderBy: { issuedAt: "desc" },
        take: 1,
        select: { netTotal: true, paidAmount: true, status: true },
      },
    },
  });
  if (!appointment) notFound();

  const canEdit =
    NURSE_VITALS_ROLES.includes(user.role) ||
    user.role === "DOCTOR" ||
    (user.role === "SUPER_ADMIN" && appointment.doctor.appUserId === user.id);
  if (!canEdit) redirect(`/appointments/${appointment.id}`);

  const visitHref = `/appointments/${appointment.id}`;
  const vitals = appointment.vitals ? toVitalsValues(appointment.vitals) : null;
  const walkInNeedsPayment = appointment.queueType === "WALK_IN" && !isConsultationPaid(appointment.invoices[0]);
  const canRecord = canNurseRecordVitals(appointment);
  const doctorOnVisit =
    user.role === "DOCTOR" || (user.role === "SUPER_ADMIN" && appointment.doctor.appUserId === user.id);
  const doctorCanSkip = doctorOnVisit && !vitals;
  const skipVitalsHref = `${visitHref}?skipVitals=1`;

  return (
    <AppShell title="Update vitals" dense>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-text-primary">
          {patientName(appointment.patient)} · Token {tokenLabel(appointment.tokenNumber)}
        </p>
        <div className="flex flex-wrap gap-2">
          {doctorCanSkip ? (
            <Link href={skipVitalsHref} className={secondaryButtonClass}>
              Skip vitals
            </Link>
          ) : null}
          <Link href={visitHref} className={secondaryButtonClass}>
            Back to visit
          </Link>
        </div>
      </div>

      {walkInNeedsPayment && !doctorOnVisit ? (
        <div className="max-w-3xl rounded-xl border border-border bg-surface p-4 shadow-card">
          <p className="mb-3 text-sm text-text-secondary">Record the consultation fee before vitals.</p>
          <Link href={`/billing/collect/${appointment.id}`} className={`${primaryButtonClass} inline-flex`}>
            Record payment
          </Link>
        </div>
      ) : !canRecord ? (
        <div className="max-w-3xl rounded-xl border border-border bg-surface p-4 shadow-card">
          <p className="text-sm text-text-secondary">
            Vitals can only be updated for today&apos;s visits. This record is locked.
          </p>
          <Link href={visitHref} className={`${secondaryButtonClass} mt-3 inline-flex`}>
            Back to visit
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {walkInNeedsPayment && doctorOnVisit ? (
            <div className="max-w-3xl rounded-xl border border-border bg-surface p-4 shadow-card">
              <p className="mb-3 text-sm text-text-secondary">
                The consultation fee is not recorded yet. You can record it now, or after these vitals.
              </p>
              <Link href={`/billing/collect/${appointment.id}`} className={`${primaryButtonClass} inline-flex`}>
                Record payment
              </Link>
            </div>
          ) : null}
          <div className="rounded-xl border border-border bg-surface p-4 shadow-card sm:p-5">
            <VitalsForm
              appointmentId={appointment.id}
              initial={vitals}
              returnTo={doctorCanSkip ? skipVitalsHref : visitHref}
              heading={vitals ? "Update today's vitals" : "Record vitals"}
            />
          </div>
        </div>
      )}
    </AppShell>
  );
}
