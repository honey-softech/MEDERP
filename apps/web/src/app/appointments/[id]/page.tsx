import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AppointmentActions } from "@/components/appointment-actions";
import { DoctorVisitActions } from "@/components/doctor-visit-actions";
import { VitalsForm } from "@/components/vitals-form";
import { VitalsPanel } from "@/components/vitals-panel";
import { ConsultAssessmentForm } from "@/components/consult-assessment-form";
import { LabOrderPanel } from "@/components/lab-order-panel";
import { PharmacyRxPanel } from "@/components/pharmacy-rx-panel";
import { VisitLabTestsForm } from "@/components/visit-lab-tests-form";
import { primaryButtonClass, secondaryButtonClass } from "@/components/auth-shell";
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

  const activeStay = await prisma.admission.findFirst({
    where: {
      hospitalId: user.hospitalId,
      patientId: appointment.patientId,
      status: { in: [...ACTIVE_ADMISSION_STATUSES] },
    },
    select: { id: true, ipNumber: true },
  });

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
  const family = appointment.patient.familyGroupId
    ? await prisma.patient.findMany({
        where: {
          hospitalId: user.hospitalId,
          familyGroupId: appointment.patient.familyGroupId,
          mergedIntoId: null,
        },
        orderBy: { createdAt: "asc" },
      })
    : [];
  const pharmacyRx =
    summaryApproved && assessment?.prescription?.trim()
      ? await getPharmacyRxForAppointment(user.hospitalId, appointment.id)
      : null;
  const photo = appointment.patient.photoData || "";

  return (
    <AppShell title="Visit details">
      <div className="mb-4 flex flex-wrap gap-2 print:hidden">
        <Link href="/appointments" className={secondaryButtonClass}>
          Appointments
        </Link>
        <Link href="/queue" className={secondaryButtonClass}>
          OPD queue
        </Link>
        <Link href={`/patients/${appointment.patientId}`} className={secondaryButtonClass}>
          Patient file
        </Link>
        {assessment && (canAssess || (canPrintSummary && summaryApproved)) ? (
          <Link href={`/appointments/${appointment.id}/summary`} className={primaryButtonClass}>
            {summaryApproved ? "View / print summary" : "Preview printed summary"}
          </Link>
        ) : null}
        {WARD_ADMIT_ROLES.includes(user.role) && !activeStay ? (
          <Link
            href={`/wards/admit?patientId=${appointment.patientId}&appointmentId=${appointment.id}`}
            className={secondaryButtonClass}
          >
            Admit to ward
          </Link>
        ) : null}
        {activeStay ? (
          <Link href={`/wards/stays/${activeStay.id}`} className={secondaryButtonClass}>
            IPD {activeStay.ipNumber}
          </Link>
        ) : null}
      </div>

      <article className="max-w-5xl space-y-4 print:hidden">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">
                    {prettyEnum(appointment.queueType)} · Token {tokenLabel(appointment.tokenNumber)}
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold">{patientName(appointment.patient)}</h2>
                  <p className="font-mono text-sm text-slate-500">{appointment.patient.mrn}</p>
                </div>
              </div>

              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <Item label="Age / gender" value={`${ageYears(appointment.patient.dateOfBirth)} yrs · ${prettyEnum(appointment.patient.gender)}`} />
                <Item label="Phone" value={appointment.patient.phone ?? "—"} />
                <Item
                  label="Family group"
                  value={appointment.patient.familyGroupCode ?? "—"}
                />
                <Item label="Doctor" value={doctorName(appointment.doctor)} />
                <Item label="Department" value={appointment.department.name} />
                <Item
                  label="Scheduled"
                  value={appointment.scheduledAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                />
                <Item label="Visit type" value={prettyEnum(appointment.visitType)} />
                <Item
                  label="Referral"
                  value={`${prettyEnum(appointment.referralSource)}${appointment.referredBy ? ` · ${appointment.referredBy}` : ""}`}
                />
                <Item
                  label="Check-in"
                  value={appointment.checkInAt?.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) ?? "—"}
                />
                <Item
                  label="Check-out"
                  value={appointment.checkOutAt?.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) ?? "—"}
                />
              </dl>

              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Reason / notes entered at booking</p>
                <p className="mt-1 rounded-xl bg-slate-50 p-3 text-sm">{appointment.reason || appointment.notes || "No notes recorded."}</p>
              </div>
            </div>
            <div className="ml-auto flex shrink-0 flex-col items-end gap-2">
              <span className="rounded-full bg-teal-50 px-3 py-1 text-xs text-teal-800">{prettyEnum(appointment.status)}</span>
              <div className="h-44 w-36 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt={patientName(appointment.patient)} className="h-full w-full object-cover object-center" />
                ) : (
                  <div className="flex h-full items-center justify-center px-2 text-center text-xs text-slate-400">
                    No photo on file
                  </div>
                )}
              </div>
            </div>
          </div>

          {vitals ? <VitalsPanel vitals={vitals} /> : (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Nurse vitals are not recorded yet. Height, weight, and temperature are required; other vitals are optional.
            </p>
          )}

          {canRecordVitals && !vitalsEditable && appointment.status !== "CANCELLED" ? (
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {visitIsToday
                ? "This visit cannot be updated."
                : "Previous visit vitals are locked. Nurses can only record vitals for today's visits."}
            </p>
          ) : null}

          {vitalsEditable ? (
            <div className="rounded-2xl border border-slate-200 p-4 print:hidden">
              <VitalsForm appointmentId={appointment.id} initial={vitals} />
            </div>
          ) : null}

          {canAssess && appointment.status !== "CANCELLED" ? (
            <div className="print:hidden space-y-4">
              {summaryApproved ? (
                <div className="rounded-xl border border-primary-light bg-primary-light/40 p-4">
                  <p className="text-sm text-primary-dark">
                    Visit summary is approved. You can still edit below and publish a new version. Reception can print the current approved record.
                  </p>
                  {canPrintSummary ? (
                    <Link href={`/appointments/${appointment.id}/summary`} className={`${primaryButtonClass} mt-3 inline-flex`}>
                      View / print record
                    </Link>
                  ) : null}
                </div>
              ) : null}
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
                initial={{
                  chiefComplaint: assessment?.chiefComplaint ?? "",
                  examination: assessment?.examination ?? "",
                  diagnosis: assessment?.diagnosis ?? "",
                  summary: assessment?.summary ?? "",
                  prescription: assessment?.prescription ?? "",
                  advice: assessment?.advice ?? "",
                  followUpAt: assessment?.followUpAt ?? "",
                }}
              />
              {canAssess && summaryApproved ? (
                <VisitLabTestsForm
                  appointmentId={appointment.id}
                  locked={false}
                  labEnabled={labEnabled}
                  patientPhone={appointment.patient.phone}
                  priorOrderCount={lockedLabOrders.length}
                  initialInvestigations={draftInvestigations}
                />
              ) : null}
            </div>
          ) : summaryApproved ? (
            <div className="space-y-4 print:hidden">
              <div className="rounded-xl border border-teal-200 bg-teal-50 p-4">
                <p className="text-sm text-teal-900">
                  Visit summary approved. Doctors and reception can open the printed record and print it.
                </p>
                {canPrintSummary ? (
                  <Link href={`/appointments/${appointment.id}/summary`} className={`${primaryButtonClass} mt-3 inline-flex`}>
                    View / print record
                  </Link>
                ) : null}
              </div>
              {assessment?.followUpAt ? (
                <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  Follow-up on {assessment.followUpAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}.
                </p>
              ) : null}
            </div>
          ) : (
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              The doctor has not approved a visit summary yet. Once it is approved, reception can print the record.
            </p>
          )}

          {canViewLab ? (
            <LabOrderPanel
              orders={appointment.labOrders}
              canCollect={canCollectLab && labEnabled}
              canWork={canWorkLab && labEnabled}
              canViewReport={canViewLabReport}
              canAttachExternal={canAttachExternal}
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

          {family.length > 0 ? (
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Family group</p>
              <ul className="mt-2 space-y-1 text-sm">
                {family.map((member) => (
                  <li key={member.id}>
                    <Link className="text-teal-700 hover:underline" href={`/patients/${member.id}`}>
                      {patientName(member)}
                    </Link>
                    <span className="text-slate-500"> · {member.mrn}</span>
                    {member.id === appointment.patientId ? <span className="text-teal-700"> · this visit</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {canDoctorVisit ? (
            <div className="rounded-2xl border border-teal-200 bg-teal-50 p-4 print:hidden">
              <p className="text-sm text-teal-900">
                {awaitingOutsideReport
                  ? "Tests or scans are being done outside. You can mark the visit done if the patient will return later. When the report is attached, update the assessment and approve the visit summary."
                  : outsideReportReady && !summaryApproved
                    ? "The outside report is on this visit. Review it, update the assessment, and approve the visit summary."
                    : "When the patient is in your room, start the consult. Fill and approve the summary, then mark the visit done so the queue moves on."}
              </p>
              <DoctorVisitActions id={appointment.id} status={appointment.status} summaryApproved={summaryApproved} />
            </div>
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
      </article>

    </AppShell>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}
