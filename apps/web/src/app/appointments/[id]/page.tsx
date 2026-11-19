import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AppointmentActions } from "@/components/appointment-actions";
import { DoctorVisitActions } from "@/components/doctor-visit-actions";
import { ConsultAssessmentForm } from "@/components/consult-assessment-form";
import { ConsultScribe } from "@/components/consult-scribe";
import { ConsultQueueNav } from "@/components/consult-queue-nav";
import { PatientContextPanel } from "@/components/patient-context-panel";
import { LabOrderPanel } from "@/components/lab-order-panel";
import { VisitAssessmentReadonly, VisitSummaryBanner } from "@/components/visit-assessment-readonly";
import { VisitLabTestsForm } from "@/components/visit-lab-tests-form";
import { compactButtonClass, compactPrimaryButtonClass, primaryButtonClass, secondaryButtonClass } from "@/components/auth-shell";
import { SendPatientMessageButton } from "@/components/send-patient-message-button";
import { EditPastRecordButton, PastRecordEditBar } from "@/components/edit-past-record-dialog";
import { PastVisitsButton, PastVisitsProvider, type PastVisitItem } from "@/components/visit-history-sheet";
import {
  CLINICAL_VIEW_ROLES,
  EXTERNAL_REPORT_UPLOAD_ROLES,
  LAB_REPORT_VIEW_ROLES,
  LAB_VIEW_ROLES,
  LAB_WORK_ROLES,
  NURSE_VITALS_ROLES,
  PRINT_SUMMARY_ROLES,
  ageYears,
  canNurseRecordVitals,
  dayRange,
  doctorName,
  isHistoricalVisit,
  isSameCalendarDay,
  canCheckoutVisit,
  canCollectOpdFee,
  hasBillingAccess,
  hasFrontDeskAccess,
  hasRoleAccess,
  patientName,
  prettyEnum,
  requireHospitalPage,
  localDayKey,
  tokenLabel,
} from "@/lib/front-desk";
import { siteFromSnapshot } from "@/lib/lab-catalog";
import { investigationsEditable } from "@/lib/lab";
import { isConsultationPaid } from "@/lib/billing/rules";
import { prisma } from "@/lib/prisma";
import { hospitalHasWardsModule } from "@/lib/subscription-tiers";
import { readHandwritingPages } from "@/lib/handwriting";
import { visitLetterhead } from "@/lib/issued-document";
import { ageGenderLine, encounterNumber, generalExaminationRows, visitDateLabel } from "@/lib/visit-summary";
import { toVitalsValues } from "@/lib/vitals";
import { isActingAsDoctor, resolveViewContext } from "@/lib/view-mode";
import { ACTIVE_ADMISSION_STATUSES, WARD_ADMIT_ROLES } from "@/lib/wards";
import { followUpReminderHint } from "@/lib/appointments/follow-up-reminder";
import { withReturnVisit } from "@/lib/appointments/return-visit";
import { resolveReturnVisit } from "@/lib/appointments/return-visit-lookup";
import type { PastVisitVitals } from "@/lib/appointments/past-visits";
import { currentVisitEditUnlock } from "@/lib/appointments/visit-edit-unlock";
import { printedPersonName } from "@/lib/display";

export default async function AppointmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string; from?: string; view?: string; date?: string; skipVitals?: string; returnVisit?: string }>;
}) {
  const user = await requireHospitalPage();
  const { id } = await params;
  const { edit, from, view: calendarView, date: calendarDate, skipVitals: skipVitalsQuery, returnVisit } = await searchParams;
  const fromCalendar = from === "calendar";
  const editing = edit === "1" || edit === "true";
  const view = await resolveViewContext(user);
  const actingAsDoctor = isActingAsDoctor(user, view.mode);
  const appointment = await prisma.appointment.findFirst({
    where: { id, hospitalId: user.hospitalId },
    include: {
      patient: {
        include: {
          familyAsPrimary: { include: { relatedPatient: true } },
        },
      },
      doctor: { include: { appUser: { select: { username: true, firstName: true, lastName: true } } } },
      department: true,
      reminders: { orderBy: { createdAt: "desc" }, take: 6 },
      vitals: true,
      assessment: true,
      invoices: {
        where: { status: { not: "VOID" } },
        orderBy: { issuedAt: "desc" },
        take: 1,
        select: { netTotal: true, paidAmount: true, status: true },
      },
      labOrders: {
        where: { status: { not: "CANCELLED" } },
        include: { items: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!appointment) notFound();

  const returnToCurrent = await resolveReturnVisit({
    hospitalId: user.hospitalId,
    patientId: appointment.patientId,
    currentAppointmentId: appointment.id,
    returnVisit,
  });
  const assessmentReturnId = returnToCurrent ?? appointment.id;
  const ownSummaryHref = withReturnVisit(
    `/appointments/${appointment.id}/summary`,
    returnToCurrent,
  );
  const ownEditHref = withReturnVisit(`/appointments/${appointment.id}?edit=1`, returnToCurrent);
  const ownVisitHref = withReturnVisit(`/appointments/${appointment.id}`, returnToCurrent);

  const canView = CLINICAL_VIEW_ROLES.includes(user.role);
  if (!canView) notFound();

  const { start, end } = dayRange(appointment.scheduledAt);
  const [activeStay, pastVisitRows, dayQueue, summarySentRow, investigationsSentRow] = await Promise.all([
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
        doctor: { include: { appUser: { select: { username: true, firstName: true, lastName: true } } } },
        assessment: {
          select: {
            diagnosis: true,
            prescription: true,
            chiefComplaint: true,
            advice: true,
            followUpAt: true,
            status: true,
            entryMode: true,
          },
        },
        vitals: true,
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
    prisma.outboundMessage.findFirst({
      where: {
        hospitalId: user.hospitalId,
        appointmentId: appointment.id,
        templateKey: "visit_summary",
        status: "SENT",
      },
      select: { id: true },
    }),
    prisma.outboundMessage.findFirst({
      where: {
        hospitalId: user.hospitalId,
        appointmentId: appointment.id,
        templateKey: "investigation_list",
        status: "SENT",
      },
      select: { id: true },
    }),
  ]);
  const summaryAlreadySent = Boolean(summarySentRow);
  const investigationsAlreadySent = Boolean(investigationsSentRow);
  const reminderAlreadySent = appointment.reminders.some(
    (row) => row.channel === "WHATSAPP" && (row.status === "SENT" || row.status === "PENDING"),
  );

  const pastVisitIds = pastVisitRows.map((row) => row.id);
  const pastSummarySentRows =
    pastVisitIds.length > 0
      ? await prisma.outboundMessage.findMany({
          where: {
            hospitalId: user.hospitalId,
            appointmentId: { in: pastVisitIds },
            templateKey: "visit_summary",
            status: "SENT",
          },
          select: { appointmentId: true },
        })
      : [];
  const pastSummarySentIds = new Set(
    pastSummarySentRows.map((row) => row.appointmentId).filter((id): id is string => Boolean(id)),
  );

  const pastVisits: PastVisitItem[] = pastVisitRows.map((row) => ({
    id: row.id,
    when: row.scheduledAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }),
    at: row.scheduledAt.toISOString(),
    doctor: doctorName(row.doctor),
    doctorId: row.doctorId,
    department: row.department.name,
    diagnosis: row.assessment?.diagnosis ?? "",
    chiefComplaint: row.assessment?.chiefComplaint ?? "",
    handwritten: row.assessment?.entryMode === "HANDWRITTEN",
    summaryApproved: row.assessment?.status === "APPROVED",
    summaryAlreadySent: pastSummarySentIds.has(row.id),
    prescription: row.assessment?.prescription ?? "",
    advice: row.assessment?.advice ?? "",
    followUpLabel: row.assessment?.followUpAt
      ? row.assessment.followUpAt.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium" })
      : null,
    vitals: row.vitals ? pastVitalsSnapshot(toVitalsValues(row.vitals)) : null,
    reports: row.labOrders
      .filter((order) => order.reportFileName)
      .map((order) => ({ id: order.id, fileName: order.reportFileName as string })),
  }));
  const priorVisit = pastVisitRows[0]
    ? {
        id: pastVisitRows[0].id,
        scheduledAtLabel: pastVisits[0].when,
        diagnosis: pastVisits[0].diagnosis,
        prescription: pastVisitRows[0].assessment?.prescription ?? "",
        chiefComplaint: pastVisits[0].chiefComplaint,
        summaryApproved: pastVisits[0].summaryApproved,
        vitals: pastVisitRows[0].vitals ? toVitalsValues(pastVisitRows[0].vitals) : null,
      }
    : null;

  const queueIndex = dayQueue.findIndex((row) => row.id === appointment.id);
  const previousId = queueIndex > 0 ? dayQueue[queueIndex - 1]?.id ?? null : null;
  const nextId = queueIndex >= 0 && queueIndex < dayQueue.length - 1 ? dayQueue[queueIndex + 1]?.id ?? null : null;

  const appointmentIsToday = isSameCalendarDay(appointment.scheduledAt);
  const scheduleView = fromCalendar && appointment.scheduledAt.getTime() >= dayRange(new Date()).end.getTime();
  const canManage = hasFrontDeskAccess(user) && (!actingAsDoctor || scheduleView);
  // Same rule as the OPD queue: doctors and nurses can collect. Super Admin collects in Admin view.
  const canCollectFee = canCollectOpdFee(user) && !(actingAsDoctor && user.role === "SUPER_ADMIN");
  const canCheckout = canCheckoutVisit(user) && !actingAsDoctor;
  const canAdmit =
    hospitalHasWardsModule(user.hospital) && hasRoleAccess(user, WARD_ADMIT_ROLES);
  const canRecordVitals = NURSE_VITALS_ROLES.includes(user.role);
  const canDoctorVisit = actingAsDoctor && !scheduleView;
  const canAssess = actingAsDoctor && !scheduleView;
  const canPrintSummary = PRINT_SUMMARY_ROLES.includes(user.role);
  const canCollectLab = hasBillingAccess(user);
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
  const assessment = appointment.assessment;
  const summaryApproved = assessment?.status === "APPROVED";
  const visitPaid = isConsultationPaid(appointment.invoices[0]);
  const walkInNeedsPayment = appointment.queueType === "WALK_IN" && !visitPaid;
  const skipVitals = skipVitalsQuery === "1" || skipVitalsQuery === "true";
  const historicalVisit = isHistoricalVisit(appointment.scheduledAt);
  const isPastRecord = Boolean(returnToCurrent) || historicalVisit;
  const pastUnlock = historicalVisit
    ? await currentVisitEditUnlock({ userId: user.id, appointmentId: appointment.id })
    : null;
  const editingPast = historicalVisit && editing && Boolean(pastUnlock);
  const visitClosed =
    appointment.status === "COMPLETED" || appointment.status === "NO_SHOW" || summaryApproved;
  const showEditableAssessment =
    canAssess &&
    appointment.status !== "CANCELLED" &&
    (isPastRecord ? (historicalVisit ? editingPast : editing) : !visitClosed || editing);
  const useCockpit =
    showEditableAssessment || (canAssess && (isPastRecord || visitClosed) && !showEditableAssessment);
  const [returnVisitMeta, revisionRow] = await Promise.all([
    returnToCurrent
      ? prisma.appointment.findFirst({
          where: { id: returnToCurrent, hospitalId: user.hospitalId },
          select: { tokenNumber: true, scheduledAt: true },
        })
      : Promise.resolve(null),
    appointment.assessment
      ? prisma.auditLog.findFirst({
          where: {
            hospitalId: user.hospitalId,
            entity: "VisitAssessment",
            entityId: appointment.assessment.id,
            action: { in: ["VISIT_SUMMARY_REVISED", "VISIT_SUMMARY_REPUBLISHED"] },
          },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true, actorUsername: true, metadata: true },
        })
      : Promise.resolve(null),
  ]);
  const revisionNote = revisionNoteFrom(revisionRow);
  const pastBackHref = returnToCurrent
    ? `/appointments/${returnToCurrent}`
    : `/patients/${appointment.patientId}`;
  const pastBackLabel = returnVisitMeta
    ? `Back to ${isSameCalendarDay(returnVisitMeta.scheduledAt) ? "today's" : "current"} consult (${patientName(appointment.patient)}, ${tokenLabel(returnVisitMeta.tokenNumber)})`
    : "Back to patient file";
  const calendarBackView = calendarView === "week" || calendarView === "list" || calendarView === "month" ? calendarView : "month";
  const calendarBackDate = /^\d{4}-\d{2}-\d{2}$/.test(calendarDate ?? "")
    ? calendarDate
    : localDayKey(appointment.scheduledAt);
  const calendarBack = fromCalendar ? `/appointments?view=${calendarBackView}&date=${calendarBackDate}` : null;
  const vitals = appointment.vitals ? toVitalsValues(appointment.vitals) : null;
  const todayVitals: PastVisitVitals | null = !isPastRecord && vitals ? pastVitalsSnapshot(vitals) : null;
  const letterhead = user.hospital
    ? visitLetterhead(appointment.assessment ?? { status: "DRAFT" }, user.hospital)
    : null;
  const writingSheet = letterhead
    ? {
        hospitalName: letterhead.name,
        hospitalAddress: letterhead.address,
        hospitalPhone: letterhead.phone,
        logoData: letterhead.logoData,
        sealData: letterhead.sealData,
        patientName: patientName(appointment.patient).toUpperCase(),
        mrn: appointment.patient.mrn,
        ageGender: ageGenderLine(appointment.patient.dateOfBirth, appointment.patient.gender),
        encounterNo: encounterNumber(letterhead.code, appointment.scheduledAt, appointment.tokenNumber),
        appointmentType: prettyEnum(appointment.visitType),
        visitDate: visitDateLabel(appointment.scheduledAt),
        physician: doctorName(appointment.doctor),
        departmentName: appointment.department.name,
        vitalsRows: generalExaminationRows(vitals),
      }
    : null;
  const vitalsEditable = canRecordVitals && canNurseRecordVitals(appointment);
  const visitIsToday = canNurseRecordVitals(appointment);
  const doctorCanEditVitals =
    user.role === "DOCTOR" ||
    (user.role === "SUPER_ADMIN" && appointment.doctor.appUserId === user.id);
  const canEditVitals =
    visitIsToday &&
    (canRecordVitals || doctorCanEditVitals) &&
    (!walkInNeedsPayment || doctorCanEditVitals);
  const vitalsHref = withReturnVisit(
    `/appointments/${appointment.id}/vitals`,
    isPastRecord ? returnToCurrent : null,
  );
  const skipVitalsHref = `/appointments/${appointment.id}?skipVitals=1`;
  const showDoctorWalkInChoice =
    showEditableAssessment &&
    appointment.queueType === "WALK_IN" &&
    !vitals &&
    !assessment &&
    !skipVitals;
  const showDoctorWalkInPayment =
    canAssess && appointment.queueType === "WALK_IN" && !visitPaid && canCollectOpdFee(user);
  const photo = appointment.patient.photoData || "";
  const testsLiveInPopup = canAssess && !isPastRecord && (showEditableAssessment || summaryApproved);
  const labCanCollect = canCollectLab && labEnabled && !isPastRecord;
  const labCanWork = canWorkLab && labEnabled && !isPastRecord;
  function labOrdersPanel() {
    if (!appointment || !canViewLab || appointment.labOrders.length === 0) return null;
    return (
      <LabOrderPanel
        embedded
        orders={appointment.labOrders}
        canCollect={labCanCollect}
        canWork={labCanWork}
        canViewReport={canViewLabReport}
        canAttachExternal={canAttachExternal}
        canPrint={canPrintSummary}
        appointmentId={appointment.id}
        patientPhone={appointment.patient.phone}
        investigationsAlreadySent={investigationsAlreadySent}
      />
    );
  }

  const pastVisitWhen = appointment.scheduledAt.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <AppShell title={isPastRecord ? "Past visit" : scheduleView ? "Appointment" : "Visit details"} dense={useCockpit}>
      <PastVisitsProvider
        visits={pastVisits}
        patientHref={`/patients/${appointment.patientId}`}
        canPrintSummary={canPrintSummary}
        canViewLabReports={canViewLabReport}
        patientPhone={appointment.patient.phone}
        returnVisitId={assessmentReturnId}
        thisDoctorId={appointment.doctorId}
        todayVitals={todayVitals}
      >
      <div className={`${useCockpit ? "flex min-w-0 flex-col gap-2 overflow-x-hidden lg:h-[calc(100dvh-4.5rem)] lg:max-h-[calc(100dvh-4.5rem)] lg:overflow-hidden" : ""} ${isPastRecord ? "rounded-xl bg-amber-50/80 p-2 sm:p-3" : ""}`.trim() || undefined}>
      {isPastRecord ? (
        <div className="sticky top-0 z-20 flex shrink-0 flex-col gap-2 rounded-xl border border-amber-300 bg-amber-100 px-3 py-2.5 print:hidden sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-950">
              Viewing a past visit · {pastVisitWhen} · {doctorName(appointment.doctor)}
              {assessment?.diagnosis?.trim() ? ` · ${assessment.diagnosis.trim()}` : ""}
            </p>
            <p className="text-xs text-amber-900">This is not the current consult.</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {historicalVisit && canAssess && !editingPast ? (
              <EditPastRecordButton
                appointmentId={appointment.id}
                returnVisitId={returnToCurrent}
                autoOpen={editing && !pastUnlock}
                label="Edit record (reason and password)"
              />
            ) : null}
            {!historicalVisit && canAssess && !editing ? (
              <Link href={ownEditHref} className={compactButtonClass}>
                Edit
              </Link>
            ) : null}
            <Link href={pastBackHref} className={compactPrimaryButtonClass}>
              {pastBackLabel}
            </Link>
          </div>
        </div>
      ) : returnToCurrent ? (
        <Link
          href={`/appointments/${returnToCurrent}`}
          className="inline-flex w-fit rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-medium text-teal-800 hover:underline print:hidden"
        >
          ← Back to current assessment
        </Link>
      ) : calendarBack ? (
        <Link href={calendarBack} className="inline-flex text-sm text-teal-700 hover:underline print:hidden">
          ← Appointments
        </Link>
      ) : null}
      <div data-tour="page:visit-header" className="mb-0 flex shrink-0 flex-col gap-2 print:hidden sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-start gap-2 sm:items-center">
          {isPastRecord ? null : (
            <ConsultQueueNav previousId={scheduleView ? null : previousId} nextId={scheduleView ? null : nextId} />
          )}
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
              {isPastRecord ? (
                <span className="rounded-full bg-amber-200 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-950">
                  Past record
                </span>
              ) : null}
              {canDoctorVisit && !isPastRecord ? (
                <div className="flex flex-wrap items-center gap-1.5 sm:hidden">
                  {canAssess && showEditableAssessment ? (
                    <div id="visit-tests-mount-mobile" />
                  ) : null}
                  {canAssess && summaryApproved && !showEditableAssessment && !isPastRecord ? (
                    <VisitLabTestsForm
                      variant="toolbar"
                      appointmentId={appointment.id}
                      locked={false}
                      labEnabled={labEnabled}
                      patientPhone={appointment.patient.phone}
                      priorOrderCount={lockedLabOrders.length}
                      initialInvestigations={draftInvestigations}
                      ordersPanel={labOrdersPanel()}
                    />
                  ) : null}
                  <DoctorVisitActions
                    id={appointment.id}
                    status={appointment.status}
                    summaryApproved={summaryApproved}
                    patientPhone={appointment.patient.phone}
                  />
                </div>
              ) : null}
            </div>
            <p className="text-xs text-text-secondary">
              {doctorName(appointment.doctor)} · {appointment.department.name} ·{" "}
              {appointment.scheduledAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })} ·{" "}
              {prettyEnum(appointment.visitType)}
            </p>
          </div>
        </div>

        <nav className="flex flex-wrap items-center gap-1.5 sm:hidden">
          {canAssess && summaryApproved ? (
            <>
              {canPrintSummary ? (
                <SendPatientMessageButton
                  endpoint={`/api/appointments/${appointment.id}/summary/send`}
                  patientPhone={appointment.patient.phone}
                  compact
                  label={isPastRecord ? "WhatsApp summary" : "WhatsApp"}
                  resendLabel="Resend"
                  alreadySent={summaryAlreadySent}
                />
              ) : null}
              {canPrintSummary ? (
                <Link href={ownSummaryHref} className={compactButtonClass}>
                  {isPastRecord ? "Print summary" : "Print"}
                </Link>
              ) : null}
              {isPastRecord ? null : (
                <Link href={ownEditHref} className={compactButtonClass}>
                  Edit
                </Link>
              )}
            </>
          ) : null}
          {!canAssess && summaryApproved && canPrintSummary ? (
            <>
              <SendPatientMessageButton
                endpoint={`/api/appointments/${appointment.id}/summary/send`}
                patientPhone={appointment.patient.phone}
                compact
                label={isPastRecord ? "WhatsApp summary" : "WhatsApp"}
                resendLabel="Resend"
                alreadySent={summaryAlreadySent}
              />
              <Link href={ownSummaryHref} className={compactButtonClass}>
                {isPastRecord ? "Print summary" : "Print"}
              </Link>
            </>
          ) : null}
          {!summaryApproved && assessment && (canAssess || canPrintSummary) ? (
            <Link href={ownSummaryHref} className={compactButtonClass}>
              Preview
            </Link>
          ) : null}
          {scheduleView || isPastRecord ? null : (
            <Link href="/queue" className={compactButtonClass}>
              Queue
            </Link>
          )}
          <PastVisitsButton label="Past visits" />
          {canAssess && !isPastRecord ? (
            <Link
              href={`/certificates/new?patientId=${appointment.patientId}&appointmentId=${appointment.id}`}
              className={compactButtonClass}
            >
              Certificate
            </Link>
          ) : null}
          {canAdmit && !activeStay && !isPastRecord ? (
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
          {canCheckout && !canManage && !isPastRecord ? (
            <AppointmentActions
              id={appointment.id}
              status={appointment.status}
              summaryApproved={summaryApproved}
              compact
              checkoutOnly
            />
          ) : null}
        </nav>

        <div className="hidden items-center gap-1.5 sm:flex sm:flex-wrap">
          {canAssess && showEditableAssessment ? (
            <div id="visit-tests-mount" />
          ) : null}
          {canAssess && summaryApproved && !showEditableAssessment && !isPastRecord ? (
            <VisitLabTestsForm
              variant="toolbar"
              appointmentId={appointment.id}
              locked={false}
              labEnabled={labEnabled}
              patientPhone={appointment.patient.phone}
              priorOrderCount={lockedLabOrders.length}
              initialInvestigations={draftInvestigations}
              ordersPanel={labOrdersPanel()}
            />
          ) : null}
          {canDoctorVisit && !summaryApproved && !isPastRecord ? (
            <DoctorVisitActions
              id={appointment.id}
              status={appointment.status}
              summaryApproved={summaryApproved}
              patientPhone={appointment.patient.phone}
            />
          ) : null}
          {canAssess && summaryApproved ? (
            <>
              {canPrintSummary ? (
                <SendPatientMessageButton
                  endpoint={`/api/appointments/${appointment.id}/summary/send`}
                  patientPhone={appointment.patient.phone}
                  compact
                  label={isPastRecord ? "WhatsApp summary" : "WhatsApp"}
                  resendLabel="Resend"
                  alreadySent={summaryAlreadySent}
                />
              ) : null}
              {canPrintSummary ? (
                <Link href={ownSummaryHref} className={compactButtonClass}>
                  {isPastRecord ? "Print summary" : "Print"}
                </Link>
              ) : null}
              {isPastRecord ? null : (
                <Link href={ownEditHref} className={compactButtonClass}>
                  Edit
                </Link>
              )}
            </>
          ) : null}
          {!canAssess && summaryApproved && canPrintSummary ? (
            <>
              <SendPatientMessageButton
                endpoint={`/api/appointments/${appointment.id}/summary/send`}
                patientPhone={appointment.patient.phone}
                compact
                label={isPastRecord ? "WhatsApp summary" : "WhatsApp"}
                resendLabel="Resend"
                alreadySent={summaryAlreadySent}
              />
              <Link href={ownSummaryHref} className={compactButtonClass}>
                {isPastRecord ? "Print summary" : "Print"}
              </Link>
            </>
          ) : null}
          {!summaryApproved && assessment && (canAssess || canPrintSummary) ? (
            <Link href={ownSummaryHref} className={compactButtonClass}>
              Preview
            </Link>
          ) : null}
          {scheduleView || isPastRecord ? null : (
            <Link href="/queue" className={compactButtonClass}>
              Queue
            </Link>
          )}
          <PastVisitsButton label="Past visits" />
          {canAssess && !isPastRecord ? (
            <Link
              href={`/certificates/new?patientId=${appointment.patientId}&appointmentId=${appointment.id}`}
              className={compactButtonClass}
            >
              Certificate
            </Link>
          ) : null}
          {canAdmit && !activeStay && !isPastRecord ? (
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
          {canCheckout && !canManage && !isPastRecord ? (
            <AppointmentActions
              id={appointment.id}
              status={appointment.status}
              summaryApproved={summaryApproved}
              compact
              checkoutOnly
            />
          ) : null}
        </div>
      </div>

      {editingPast && pastUnlock ? (
        <PastRecordEditBar
          appointmentId={appointment.id}
          reason={pastUnlock.reason}
          expiresAt={pastUnlock.expiresAt}
          cancelHref={ownVisitHref}
        />
      ) : editing && visitClosed && showEditableAssessment ? (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 print:hidden">
          <p className="text-xs text-amber-900">Editing approved visit — publish again when finished.</p>
          <Link href={ownVisitHref} className={compactButtonClass}>
            Cancel edit
          </Link>
        </div>
      ) : null}
      {!isPastRecord && !showEditableAssessment && canAssess && visitClosed ? (
        <div className="shrink-0 print:hidden">
          <VisitSummaryBanner
            statusLabel={prettyEnum(appointment.status)}
            summaryApproved={summaryApproved}
          />
        </div>
      ) : null}

      <div className={`print:hidden ${useCockpit ? "flex min-w-0 flex-col gap-3 overflow-x-hidden lg:min-h-0 lg:flex-1 lg:flex-row lg:items-stretch lg:gap-4" : "mx-auto max-w-5xl space-y-4"}`}>
        {!useCockpit && summaryApproved ? (
          <div className="space-y-3 rounded-xl border border-teal-200 bg-teal-50 p-4">
            <p className="text-sm text-teal-900">
              {summaryAlreadySent
                ? "Visit summary was sent on WhatsApp. You can resend or print the record."
                : "Visit summary approved. Send it on WhatsApp or print the record."}
            </p>
            {canPrintSummary ? (
              <div className="flex flex-wrap gap-2">
                <SendPatientMessageButton
                  endpoint={`/api/appointments/${appointment.id}/summary/send`}
                  patientPhone={appointment.patient.phone}
                  label="Send on WhatsApp"
                  resendLabel="Resend WhatsApp"
                  alreadySent={summaryAlreadySent}
                />
                <Link href={ownSummaryHref} className={`${primaryButtonClass} inline-flex`}>
                  View / print record
                </Link>
              </div>
            ) : null}
            {assessment?.followUpAt ? (
              <p className="text-sm text-slate-700">
                Follow-up on {assessment.followUpAt.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium" })}.
              </p>
            ) : null}
          </div>
        ) : null}
        <div data-tour="page:visit-context" className={useCockpit ? "min-w-0 space-y-2 lg:min-h-0 lg:w-[clamp(12rem,18vw,20rem)] lg:shrink-0 lg:self-stretch lg:overflow-y-auto lg:[scrollbar-gutter:stable]" : undefined}>
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
          recordVitalsHref={
            isPastRecord ? (editingPast && doctorCanEditVitals ? vitalsHref : null) : canEditVitals ? vitalsHref : null
          }
          compareLabel={isPastRecord ? "Since the visit before" : "Since last visit"}
          priorVisit={
            appointment.visitType === "FOLLOW_UP" && priorVisit
              ? {
                  id: priorVisit.id,
                  scheduledAtLabel: priorVisit.scheduledAtLabel,
                  summaryApproved: priorVisit.summaryApproved,
                  vitals: priorVisit.vitals,
                  diagnosis: priorVisit.diagnosis,
                }
              : null
          }
          returnVisitId={assessmentReturnId}
        />
        {useCockpit && canViewLab && !testsLiveInPopup ? (
          <LabOrderPanel
            orders={appointment.labOrders}
            canCollect={labCanCollect}
            canWork={labCanWork}
            canViewReport={canViewLabReport}
            canAttachExternal={canAttachExternal}
            canPrint={canPrintSummary}
            appointmentId={appointment.id}
            patientPhone={appointment.patient.phone}
            investigationsAlreadySent={investigationsAlreadySent}
          />
        ) : null}
        </div>

        {showEditableAssessment ? (
          <div data-tour="page:visit-work" className="flex min-w-0 flex-col space-y-3 lg:min-h-0 lg:flex-1 lg:self-stretch lg:overflow-hidden">
          {showDoctorWalkInChoice ? (
            <div className="rounded-xl border border-border bg-surface p-4 shadow-card print:hidden">
              <p className="text-sm text-text-secondary">
                {visitPaid
                  ? "This walk-in has no vitals yet. Record them, or skip vitals and start the consult."
                  : "This walk-in has no vitals yet. Record the consultation fee, record vitals, or skip vitals and start the consult."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {showDoctorWalkInPayment ? (
                  <Link href={`/billing/collect/${appointment.id}`} className={`${primaryButtonClass} inline-flex`}>
                    Record payment
                  </Link>
                ) : null}
                <Link href={vitalsHref} className={`${secondaryButtonClass} inline-flex`}>
                  Record vitals
                </Link>
                <Link href={skipVitalsHref} className={`${secondaryButtonClass} inline-flex`}>
                  Skip vitals
                </Link>
              </div>
            </div>
          ) : (
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
            priorVisit={
              priorVisit
                ? {
                    diagnosis: priorVisit.diagnosis,
                    prescription: priorVisit.prescription,
                    chiefComplaint: priorVisit.chiefComplaint,
                  }
                : null
            }
            cockpit
            allergies={appointment.patient.allergies}
            currentMedications={appointment.patient.currentMedications}
            nextAppointmentId={isPastRecord ? null : nextId}
            testsMountId={useCockpit && showEditableAssessment ? "visit-tests-mount" : null}
            ordersPanel={labOrdersPanel()}
            followUpReminderNote={followUpReminderHint(user.hospital)}
            initialEntryMode={
              assessment ? (assessment.entryMode === "HANDWRITTEN" ? "HANDWRITTEN" : "TYPED") : null
            }
            initialHandwritingPages={readHandwritingPages(assessment?.handwritingPages)}
            sheet={writingSheet}
            aiScribeEnabled={Boolean(user.hospital?.aiScribeEnabled) && !isPastRecord}
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
            {!isPastRecord && (showDoctorWalkInPayment || (canCollectFee && !visitPaid)) ? (
              <div className="print:hidden">
                <Link href={`/billing/collect/${appointment.id}`} className={`${primaryButtonClass} mb-3 inline-flex`}>
                  Record payment
                </Link>
              </div>
            ) : null}
            {!isPastRecord && canManage ? (
              <div className="print:hidden">
                <AppointmentActions
                  id={appointment.id}
                  status={appointment.status}
                  summaryApproved={summaryApproved}
                  reminderAlreadySent={reminderAlreadySent}
                />
              </div>
            ) : !isPastRecord && canCheckout ? (
              <div className="print:hidden">
                <AppointmentActions
                  id={appointment.id}
                  status={appointment.status}
                  summaryApproved={summaryApproved}
                  checkoutOnly
                />
              </div>
            ) : null}
          </ConsultAssessmentForm>
          )}
          </div>
        ) : isPastRecord || (canAssess && visitClosed) ? (
          <div data-tour="page:visit-work" className="min-w-0 space-y-3 lg:min-h-0 lg:flex-1 lg:self-stretch lg:overflow-y-auto lg:[scrollbar-gutter:stable]">
            {!isPastRecord && user.hospital?.aiScribeEnabled ? <ConsultScribe appointmentId={appointment.id} mode="view" /> : null}
            <VisitAssessmentReadonly
              omitBanner
              appointmentId={appointment.id}
              statusLabel={prettyEnum(appointment.status)}
              summaryApproved={summaryApproved}
              canEdit={canAssess && !isPastRecord}
              canPrint={canPrintSummary}
              patientPhone={appointment.patient.phone}
              chiefComplaint={assessment?.chiefComplaint}
              examination={assessment?.examination}
              diagnosis={assessment?.diagnosis}
              summary={assessment?.summary}
              prescription={assessment?.prescription}
              advice={assessment?.advice}
              visitOutcome={assessment?.visitOutcome}
              followUpAt={assessment?.followUpAt}
              entryMode={assessment?.entryMode}
              handwritingPages={readHandwritingPages(assessment?.handwritingPages)}
              aiAssisted={Boolean(assessment?.aiAssisted)}
              revisionNote={revisionNote}
            />
            {!isPastRecord && canCollectFee && !visitPaid ? (
              <div className="print:hidden">
                <Link href={`/billing/collect/${appointment.id}`} className={`${primaryButtonClass} mb-3 inline-flex`}>
                  Record payment
                </Link>
              </div>
            ) : null}
            {!isPastRecord && canManage ? (
              <div className="print:hidden">
                <AppointmentActions
                  id={appointment.id}
                  status={appointment.status}
                  summaryApproved={summaryApproved}
                  reminderAlreadySent={reminderAlreadySent}
                />
              </div>
            ) : !isPastRecord && canCheckout ? (
              <div className="print:hidden">
                <AppointmentActions
                  id={appointment.id}
                  status={appointment.status}
                  summaryApproved={summaryApproved}
                  checkoutOnly
                />
              </div>
            ) : null}
          </div>
        ) : (
        <div data-tour="page:visit-work" className="min-w-0 space-y-4">
          {walkInNeedsPayment ? (
            <div className="rounded-xl border border-border bg-surface p-4 shadow-card print:hidden">
              <p className="mb-3 text-sm text-text-secondary">Record the consultation fee, then record vitals.</p>
              <Link href={`/billing/collect/${appointment.id}`} className={`${primaryButtonClass} inline-flex`}>
                Record payment
              </Link>
            </div>
          ) : null}
          {!scheduleView && !walkInNeedsPayment && canCollectFee && !visitPaid ? (
            <div className="rounded-xl border border-border bg-surface p-4 shadow-card print:hidden">
              <p className="mb-3 text-sm text-text-secondary">
                {appointmentIsToday
                  ? "Record the consultation fee for today's visit. Check-in and vitals can follow."
                  : "This visit still has a consultation fee to record."}
              </p>
              <Link href={`/billing/collect/${appointment.id}`} className={`${primaryButtonClass} inline-flex`}>
                Record payment
              </Link>
            </div>
          ) : null}
          {!walkInNeedsPayment && vitalsEditable ? (
            <div className="rounded-xl border border-border bg-surface p-4 shadow-card print:hidden">
              <h3 className="text-sm font-semibold">Vitals</h3>
              <p className="mt-1 text-sm text-text-secondary">
                Record or update vitals on their own screen. Saving opens this visit for the doctor.
              </p>
              <Link href={vitalsHref} className={`${primaryButtonClass} mt-3 inline-flex`}>
                {vitals ? "Update vitals" : "Record vitals"}
              </Link>
            </div>
          ) : null}

          {canRecordVitals && !vitalsEditable && appointment.status !== "CANCELLED" ? (
            <p className="rounded-xl border border-border bg-app-bg px-3 py-2 text-sm text-text-secondary">
              {visitIsToday
                ? "This visit cannot be updated."
                : "Previous visit vitals are locked. Nurses can only record vitals for today's visits."}
            </p>
          ) : null}

          {summaryApproved ? null : scheduleView && appointment.status === "SCHEDULED" ? (
            <p className="rounded-xl border border-border bg-app-bg px-3 py-2 text-sm text-text-secondary">
              This visit is booked
              {appointment.reason ? ` · ${appointment.reason}` : ""}. On the day, open it here or from the OPD queue to record payment, check the patient in, record vitals, and write the assessment.
            </p>
          ) : (
            <p className="rounded-xl border border-border bg-app-bg px-3 py-2 text-sm text-text-secondary">
              The doctor has not approved a visit summary yet.
            </p>
          )}

          {canViewLab ? (
            <LabOrderPanel
              orders={appointment.labOrders}
              canCollect={labCanCollect}
              canWork={labCanWork}
              canViewReport={canViewLabReport}
              canAttachExternal={canAttachExternal}
              canPrint={canPrintSummary}
              appointmentId={appointment.id}
              patientPhone={appointment.patient.phone}
              investigationsAlreadySent={investigationsAlreadySent}
            />
          ) : null}

          {canManage ? (
            <div className="print:hidden">
              <AppointmentActions
                id={appointment.id}
                status={appointment.status}
                summaryApproved={summaryApproved}
                reminderAlreadySent={reminderAlreadySent}
              />
            </div>
          ) : canCheckout ? (
            <div className="print:hidden">
              <AppointmentActions
                id={appointment.id}
                status={appointment.status}
                summaryApproved={summaryApproved}
                checkoutOnly
              />
            </div>
          ) : null}
        </div>
        )}
      </div>
      </div>
      </PastVisitsProvider>
    </AppShell>
  );
}

function pastVitalsSnapshot(vitals: {
  bpSystolic: number | null;
  bpDiastolic: number | null;
  pulseBpm: number | null;
  temperatureC: number;
  spo2Percent: number | null;
  weightKg: number;
}): PastVisitVitals {
  return {
    bpSystolic: vitals.bpSystolic,
    bpDiastolic: vitals.bpDiastolic,
    pulseBpm: vitals.pulseBpm,
    temperatureC: vitals.temperatureC,
    spo2Percent: vitals.spo2Percent,
    weightKg: vitals.weightKg,
  };
}

function revisionNoteFrom(
  row: { createdAt: Date; actorUsername: string; metadata: unknown } | null,
) {
  if (!row || !row.metadata || typeof row.metadata !== "object" || Array.isArray(row.metadata)) return null;
  const reason = "reason" in row.metadata && typeof row.metadata.reason === "string" ? row.metadata.reason.trim() : "";
  if (!reason) return null;
  const who = printedPersonName(row.actorUsername) || row.actorUsername;
  const when = row.createdAt.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });
  return `Edited ${when} by ${who}: ${reason}`;
}
