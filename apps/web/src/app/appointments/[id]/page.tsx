import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AppointmentActions } from "@/components/appointment-actions";
import { DoctorVisitActions } from "@/components/doctor-visit-actions";
import { VitalsForm } from "@/components/vitals-form";
import { ConsultAssessmentForm } from "@/components/consult-assessment-form";
import { ConsultQueueNav } from "@/components/consult-queue-nav";
import { PatientContextPanel } from "@/components/patient-context-panel";
import { LabOrderPanel } from "@/components/lab-order-panel";
import { PharmacyRxPanel } from "@/components/pharmacy-rx-panel";
import { VisitLabTestsForm } from "@/components/visit-lab-tests-form";
import { compactButtonClass, primaryButtonClass } from "@/components/auth-shell";
import { VisitHistorySheet, type PastVisitItem } from "@/components/visit-history-sheet";
import {
  BILLING_ROLES,
  CLINICAL_VIEW_ROLES,
  DOCTOR_VISIT_ROLES,
  EXTERNAL_REPORT_UPLOAD_ROLES,
  FRONT_DESK_ROLES,
  LAB_REPORT_VIEW_ROLES,
  LAB_VIEW_ROLES,
  LAB_WORK_ROLES,
  NURSE_VITALS_ROLES,
  PRINT_SUMMARY_ROLES,
  ageYears,
  canNurseRecordVitals,
  dayRange,
  doctorName,
  patientName,
  prettyEnum,
  requireHospitalPage,
  tokenLabel,
} from "@/lib/front-desk";
import { siteFromSnapshot } from "@/lib/lab-catalog";
import { investigationsEditable } from "@/lib/lab";
import { prisma } from "@/lib/prisma";
import { toVitalsValues } from "@/lib/vitals";
import { getPharmacyRxForAppointment, PHARMACY_BILLING_ROLES } from "@/lib/pharmacy-rx";
import { ACTIVE_ADMISSION_STATUSES, WARD_ADMIT_ROLES } from "@/lib/wards";

export default async function AppointmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireHospitalPage();
  const { id } = await params;
  const appointment = await prisma.appointment.findFirst({
    where: { id, hospitalId: user.hospitalId },
    include: {
      patient: {
        include: {
          familyAsPrimary: { include: { relatedPatient: true } },
        },
      },
      doctor: { include: { appUser: { select: { username: true } } } },
      department: true,
      reminders: { orderBy: { createdAt: "desc" }, take: 6 },
      vitals: true,
      assessment: true,
      labOrders: {
        where: { status: { not: "CANCELLED" } },
        include: { items: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!appointment) notFound();

  const canView = CLINICAL_VIEW_ROLES.includes(user.role);
  if (!canView) notFound();

  const { start, end } = dayRange(appointment.scheduledAt);
  const [activeStay, pastVisitRows, dayQueue] = await Promise.all([
    prisma.admission.findFirst({
      where: {
        hospitalId: user.hospitalId,
        patientId: appointment.patientId,
        status: { in: [...ACTIVE_ADMISSION_STATUSES] },
      },
      select: { id: true, ipNumber: true },
    }),
    prisma.appointment.findMany({
      where: {
        hospitalId: user.hospitalId,
        patientId: appointment.patientId,
        id: { not: appointment.id },
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
      },
      orderBy: { scheduledAt: "desc" },
      take: 20,
      include: {
        department: { select: { name: true } },
        doctor: { include: { appUser: { select: { username: true } } } },
        assessment: {
          select: {
            diagnosis: true,
            prescription: true,
            chiefComplaint: true,
            status: true,
          },
        },
        labOrders: {
          where: { status: "RESULTED", reportFileName: { not: null } },
          select: { id: true, reportFileName: true },
        },
      },
    }),
    prisma.appointment.findMany({
      where: {
        hospitalId: user.hospitalId,
        doctorId: appointment.doctorId,
        scheduledAt: { gte: start, lt: end },
        status: { notIn: ["CANCELLED"] },
      },
      orderBy: [{ tokenNumber: "asc" }, { scheduledAt: "asc" }],
      select: { id: true },
    }),
  ]);

  const pastVisits: PastVisitItem[] = pastVisitRows.map((row) => ({
    id: row.id,
    when: row.scheduledAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }),
    doctor: doctorName(row.doctor),
    department: row.department.name,
    diagnosis: row.assessment?.diagnosis ?? "",
    chiefComplaint: row.assessment?.chiefComplaint ?? "",
    summaryApproved: row.assessment?.status === "APPROVED",
    reports: row.labOrders
      .filter((order) => order.reportFileName)
      .map((order) => ({ id: order.id, fileName: order.reportFileName as string })),
  }));
  const priorVisit = pastVisitRows[0]
    ? {
        scheduledAtLabel: pastVisits[0].when,
        diagnosis: pastVisits[0].diagnosis,
        prescription: pastVisitRows[0].assessment?.prescription ?? "",
        chiefComplaint: pastVisits[0].chiefComplaint,
      }
    : null;

  const queueIndex = dayQueue.findIndex((row) => row.id === appointment.id);
  const previousId = queueIndex > 0 ? dayQueue[queueIndex - 1]?.id ?? null : null;
  const nextId = queueIndex >= 0 && queueIndex < dayQueue.length - 1 ? dayQueue[queueIndex + 1]?.id ?? null : null;

  const canManage = FRONT_DESK_ROLES.includes(user.role);
  const canRecordVitals = NURSE_VITALS_ROLES.includes(user.role);
  const canDoctorVisit = user.role === "DOCTOR" || user.role === "SUPER_ADMIN";
  const canAssess = DOCTOR_VISIT_ROLES.includes(user.role);
  const canPrintSummary = PRINT_SUMMARY_ROLES.includes(user.role);
  const canCollectLab = BILLING_ROLES.includes(user.role);
  const canWorkLab = LAB_WORK_ROLES.includes(user.role);
  const canViewLab = LAB_VIEW_ROLES.includes(user.role);
  const canViewLabReport = LAB_REPORT_VIEW_ROLES.includes(user.role);
  const canAttachExternal = EXTERNAL_REPORT_UPLOAD_ROLES.includes(user.role);
  const labEnabled = Boolean(user.hospital?.labEnabled);
  const editableLabOrder = appointment.labOrders.find((order) => investigationsEditable(order)) ?? null;
  const lockedLabOrders = appointment.labOrders.filter((order) => !investigationsEditable(order));
  const draftInvestigations =
    editableLabOrder?.items.map((item) => ({
      testId: item.testId,
      siteLabel: siteFromSnapshot(item.nameSnapshot),
    })) ?? [];
  const awaitingOutsideReport = appointment.labOrders.some(
    (order) => order.fulfillment === "EXTERNAL" && order.status === "AWAITING_EXTERNAL_REPORT",
  );
  const outsideReportReady = appointment.labOrders.some(
    (order) => order.fulfillment === "EXTERNAL" && order.status === "RESULTED",
  );
  const canCollectPharmacy = PHARMACY_BILLING_ROLES.includes(user.role);
  const assessment = appointment.assessment;
  const summaryApproved = assessment?.status === "APPROVED";
  const vitals = appointment.vitals ? toVitalsValues(appointment.vitals) : null;
  const vitalsEditable = canRecordVitals && canNurseRecordVitals(appointment);
  const visitIsToday = canNurseRecordVitals(appointment);
  const pharmacyRx =
    summaryApproved && assessment?.prescription?.trim()
      ? await getPharmacyRxForAppointment(user.hospitalId, appointment.id)
      : null;
  const photo = appointment.patient.photoData || "";
  const useCockpit = canAssess && appointment.status !== "CANCELLED";

  return (
    <AppShell title="Visit details" dense={useCockpit}>
      <div className={useCockpit ? "flex min-w-0 flex-col gap-2 overflow-x-hidden" : undefined}>
      <div className="mb-0 flex shrink-0 flex-col gap-2 print:hidden sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-start gap-2 sm:items-center">
          <ConsultQueueNav previousId={previousId} nextId={nextId} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">
              {prettyEnum(appointment.queueType)} · Token {tokenLabel(appointment.tokenNumber)}
              {queueIndex >= 0 ? ` · ${queueIndex + 1}/${dayQueue.length}` : ""}
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-semibold text-text-primary sm:text-xl">
                {patientName(appointment.patient)}
              </h2>
              <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs text-teal-800">
                {prettyEnum(appointment.status)}
              </span>
              {canDoctorVisit ? (
                <div className="sm:hidden">
                  <DoctorVisitActions
                    id={appointment.id}
                    status={appointment.status}
                    summaryApproved={summaryApproved}
                    showHint={false}
                  />
                </div>
              ) : null}
            </div>
            <p className="text-xs text-text-secondary">
              {doctorName(appointment.doctor)} · {appointment.department.name} ·{" "}
              {appointment.scheduledAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} ·{" "}
              {prettyEnum(appointment.visitType)}
            </p>
          </div>
        </div>

        <nav className="flex flex-wrap items-center gap-1.5 sm:hidden">
          <Link href="/queue" className={compactButtonClass}>
            Queue
          </Link>
          <VisitHistorySheet
            visits={pastVisits}
            patientHref={`/patients/${appointment.patientId}`}
            canPrintSummary={canPrintSummary}
            canViewLabReports={canViewLabReport}
            label="Past visits"
          />
          {assessment && (canAssess || (canPrintSummary && summaryApproved)) ? (
            <Link href={`/appointments/${appointment.id}/summary`} className={compactButtonClass}>
              {summaryApproved ? "Print" : "Preview"}
            </Link>
          ) : null}
          {WARD_ADMIT_ROLES.includes(user.role) && !activeStay ? (
            <Link
              href={`/wards/admit?patientId=${appointment.patientId}&appointmentId=${appointment.id}`}
              className={compactButtonClass}
            >
              Admit
            </Link>
          ) : null}
          {activeStay ? (
            <Link href={`/wards/stays/${activeStay.id}`} className={compactButtonClass}>
              IPD {activeStay.ipNumber}
            </Link>
          ) : null}
        </nav>

        <div className="hidden flex-wrap gap-1.5 sm:flex">
          {canDoctorVisit ? (
            <DoctorVisitActions
              id={appointment.id}
              status={appointment.status}
              summaryApproved={summaryApproved}
              showHint={false}
            />
          ) : null}
          <Link href="/queue" className={compactButtonClass}>
            Queue
          </Link>
          <VisitHistorySheet
            visits={pastVisits}
            patientHref={`/patients/${appointment.patientId}`}
            canPrintSummary={canPrintSummary}
            canViewLabReports={canViewLabReport}
            label="Past visits"
          />
          {assessment && (canAssess || (canPrintSummary && summaryApproved)) ? (
            <Link href={`/appointments/${appointment.id}/summary`} className={compactButtonClass}>
              {summaryApproved ? "Print" : "Preview"}
            </Link>
          ) : null}
          {WARD_ADMIT_ROLES.includes(user.role) && !activeStay ? (
            <Link
              href={`/wards/admit?patientId=${appointment.patientId}&appointmentId=${appointment.id}`}
              className={compactButtonClass}
            >
              Admit
            </Link>
          ) : null}
          {activeStay ? (
            <Link href={`/wards/stays/${activeStay.id}`} className={compactButtonClass}>
              IPD {activeStay.ipNumber}
            </Link>
          ) : null}
        </div>
      </div>

      <div className={`print:hidden ${useCockpit ? "grid min-w-0 gap-3 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)]" : "mx-auto max-w-5xl space-y-4"}`}>
        <div className={useCockpit ? "min-w-0 lg:sticky lg:top-3" : undefined}>
        <PatientContextPanel
          patient={{
            id: appointment.patient.id,
            name: patientName(appointment.patient),
            mrn: appointment.patient.mrn,
            ageGender: `${ageYears(appointment.patient.dateOfBirth)} yrs · ${prettyEnum(appointment.patient.gender)}`,
            phone: appointment.patient.phone ?? "",
            address: appointment.patient.address ?? "",
            bloodGroup: appointment.patient.bloodGroup ?? "",
            photo,
            allergies: appointment.patient.allergies ?? "",
            medicalHistory: appointment.patient.medicalHistory ?? "",
            familyHistory: appointment.patient.familyHistory ?? "",
            socialHistory: appointment.patient.socialHistory ?? "",
            currentMedications: appointment.patient.currentMedications ?? "",
          }}
          vitals={vitals}
          canEditHistory={canAssess || canManage}
          canPrintSummary={canPrintSummary}
          canViewLabReports={canViewLabReport}
          pastVisits={pastVisits}
          priorVisit={priorVisit}
        />
        </div>

        {useCockpit ? (
          <div className="min-w-0">
          <ConsultAssessmentForm
            appointmentId={appointment.id}
            canPreview={Boolean(assessment)}
            alreadyApproved={summaryApproved}
            testsLocked={false}
            labEnabled={labEnabled}
            patientPhone={appointment.patient.phone}
            awaitingOutsideReport={awaitingOutsideReport}
            outsideReportReady={outsideReportReady}
            priorOrderCount={lockedLabOrders.length}
            initialInvestigations={draftInvestigations}
            visitReason={appointment.reason || appointment.notes || ""}
            cockpit
            initial={{
              chiefComplaint: assessment?.chiefComplaint ?? "",
              examination: assessment?.examination ?? "",
              diagnosis: assessment?.diagnosis ?? "",
              summary: assessment?.summary ?? "",
              prescription: assessment?.prescription ?? "",
              advice: assessment?.advice ?? "",
              visitOutcome: assessment?.visitOutcome ?? "",
              followUpAt: assessment?.followUpAt
                ? new Date(assessment.followUpAt).toISOString().slice(0, 10)
                : "",
            }}
          >
            {vitalsEditable ? (
              <div className="rounded-xl border border-border bg-surface p-3 shadow-card print:hidden">
                <h3 className="mb-2 text-sm font-semibold">Record vitals</h3>
                <VitalsForm appointmentId={appointment.id} initial={vitals} />
              </div>
            ) : null}
            {summaryApproved ? (
              <VisitLabTestsForm
                appointmentId={appointment.id}
                locked={false}
                labEnabled={labEnabled}
                patientPhone={appointment.patient.phone}
                priorOrderCount={lockedLabOrders.length}
                initialInvestigations={draftInvestigations}
              />
            ) : null}
            {canViewLab ? (
              <LabOrderPanel
                orders={appointment.labOrders}
                canCollect={canCollectLab && labEnabled}
                canWork={canWorkLab && labEnabled}
                canViewReport={canViewLabReport}
                canAttachExternal={canAttachExternal}
                canPrint={canPrintSummary}
                appointmentId={appointment.id}
                patientPhone={appointment.patient.phone}
              />
            ) : null}
            {pharmacyRx && pharmacyRx.status !== "CANCELLED" ? (
              <PharmacyRxPanel
                order={{
                  id: pharmacyRx.id,
                  appointmentId: pharmacyRx.appointmentId,
                  status: pharmacyRx.status,
                  totalAmount: Number(pharmacyRx.totalAmount),
                  invoiceId: pharmacyRx.invoiceId,
                  lines: pharmacyRx.lines.map((line) => ({
                    medicineName: line.medicineName,
                    quantity: line.quantity,
                    inStock: line.inStock,
                    doseNotes: line.doseNotes,
                  })),
                }}
                canBill={canCollectPharmacy}
              />
            ) : null}
            {canManage ? (
              <div className="print:hidden">
                <Link href={`/billing/collect/${appointment.id}`} className={`${primaryButtonClass} mb-3 inline-flex`}>
                  Record payment
                </Link>
                <AppointmentActions id={appointment.id} status={appointment.status} />
              </div>
            ) : null}
          </ConsultAssessmentForm>
          </div>
        ) : (
        <div className="min-w-0 space-y-4">
          {vitalsEditable ? (
            <div className="rounded-xl border border-border bg-surface p-3 shadow-card print:hidden">
              <h3 className="mb-2 text-sm font-semibold">Record vitals</h3>
              <VitalsForm appointmentId={appointment.id} initial={vitals} />
            </div>
          ) : null}

          {canRecordVitals && !vitalsEditable && appointment.status !== "CANCELLED" ? (
            <p className="rounded-xl border border-border bg-app-bg px-3 py-2 text-sm text-text-secondary">
              {visitIsToday
                ? "This visit cannot be updated."
                : "Previous visit vitals are locked. Nurses can only record vitals for today's visits."}
            </p>
          ) : null}

          {summaryApproved ? (
            <div className="space-y-3 rounded-xl border border-teal-200 bg-teal-50 p-4">
              <p className="text-sm text-teal-900">Visit summary approved.</p>
              {canPrintSummary ? (
                <Link href={`/appointments/${appointment.id}/summary`} className={`${primaryButtonClass} inline-flex`}>
                  View / print record
                </Link>
              ) : null}
              {assessment?.followUpAt ? (
                <p className="text-sm text-slate-700">
                  Follow-up on {assessment.followUpAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}.
                </p>
              ) : null}
            </div>
          ) : (
            <p className="rounded-xl border border-border bg-app-bg px-3 py-2 text-sm text-text-secondary">
              The doctor has not approved a visit summary yet.
            </p>
          )}

          {canViewLab ? (
            <LabOrderPanel
              orders={appointment.labOrders}
              canCollect={canCollectLab && labEnabled}
              canWork={canWorkLab && labEnabled}
              canViewReport={canViewLabReport}
              canAttachExternal={canAttachExternal}
              canPrint={canPrintSummary}
              appointmentId={appointment.id}
              patientPhone={appointment.patient.phone}
            />
          ) : null}

          {pharmacyRx && pharmacyRx.status !== "CANCELLED" ? (
            <PharmacyRxPanel
              order={{
                id: pharmacyRx.id,
                appointmentId: pharmacyRx.appointmentId,
                status: pharmacyRx.status,
                totalAmount: Number(pharmacyRx.totalAmount),
                invoiceId: pharmacyRx.invoiceId,
                lines: pharmacyRx.lines.map((line) => ({
                  medicineName: line.medicineName,
                  quantity: line.quantity,
                  inStock: line.inStock,
                  doseNotes: line.doseNotes,
                })),
              }}
              canBill={canCollectPharmacy}
            />
          ) : null}

          {canManage ? (
            <div className="print:hidden">
              <Link href={`/billing/collect/${appointment.id}`} className={`${primaryButtonClass} mb-3 inline-flex`}>
                Record payment
              </Link>
              <AppointmentActions id={appointment.id} status={appointment.status} />
            </div>
          ) : null}
        </div>
        )}
      </div>
      </div>
    </AppShell>
  );
}
