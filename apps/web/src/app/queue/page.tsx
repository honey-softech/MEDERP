import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AppointmentActions } from "@/components/appointment-actions";
import { DoctorVisitActions } from "@/components/doctor-visit-actions";
import {
  compactButtonClass,
  compactPrimaryButtonClass,
} from "@/components/auth-shell";
import { OpdDayNav } from "@/components/opd-day-nav";
import {
  CLINICAL_VIEW_ROLES,
  DOCTOR_VISIT_ROLES,
  FRONT_DESK_ROLES,
  NURSE_VITALS_ROLES,
  PRINT_SUMMARY_ROLES,
  WALK_IN_ROLES,
  dayRange,
  doctorName,
  groupByDoctor,
  listBookableDoctors,
  localDayKey,
  parseLocalDay,
  patientName,
  prettyEnum,
  requireHospitalPage,
  staffIdForAppUser,
  tokenLabel,
} from "@/lib/front-desk";
import { statusBadge, statusBadgeBase } from "@/lib/ui";
import { prisma } from "@/lib/prisma";

export default async function QueuePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const user = await requireHospitalPage();
  if (!CLINICAL_VIEW_ROLES.includes(user.role)) redirect("/");
  const { date } = await searchParams;
  const selectedDay = parseLocalDay(date);
  const { start, end } = dayRange(selectedDay);
  const dateValue = localDayKey(start);
  const isToday = dateValue === localDayKey(new Date());
  const dayLabel = start.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const myDoctorId =
    user.role === "DOCTOR" ? await staffIdForAppUser(user.id, user.hospitalId) : null;

  const [queue, doctors] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        hospitalId: user.hospitalId,
        scheduledAt: { gte: start, lt: end },
        status: { notIn: ["CANCELLED"] },
        ...(myDoctorId ? { doctorId: myDoctorId } : {}),
      },
      orderBy: [{ tokenNumber: "asc" }, { scheduledAt: "asc" }],
      include: {
        patient: true,
        doctor: { include: { appUser: { select: { username: true } } } },
        department: true,
        vitals: { select: { id: true } },
        assessment: { select: { id: true, status: true } },
      },
    }),
    listBookableDoctors(user.hospitalId),
  ]);

  const grouped = groupByDoctor(queue);
  const seen = new Set(grouped.map((group) => group.doctorId));
  const emptyDoctors =
    myDoctorId
      ? []
      : doctors
          .filter((doctor) => !seen.has(doctor.id))
          .map((doctor) => ({
            doctorId: doctor.id,
            doctor,
            items: [] as typeof queue,
            waiting: 0,
            inConsult: 0,
            lastToken: 0,
          }));
  const doctorQueues = isToday ? [...grouped, ...emptyDoctors] : grouped;
  const canManage = FRONT_DESK_ROLES.includes(user.role);
  const canRecordVitals = NURSE_VITALS_ROLES.includes(user.role);
  const canDoctorVisit = DOCTOR_VISIT_ROLES.includes(user.role);
  const canPrintSummary = PRINT_SUMMARY_ROLES.includes(user.role);
  const waiting = queue.filter((row) => row.status === "SCHEDULED").length;
  const checkedIn = queue.filter((row) => row.status === "CHECKED_IN" || row.status === "IN_PROGRESS").length;
  const completed = queue.filter((row) => row.status === "COMPLETED").length;

  return (
    <AppShell title={myDoctorId ? "My OPD queue" : "OPD queue"} dense>
      <div className="mb-3 flex min-w-0 flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-[13px] text-text-secondary 2xl:text-sm">
            {isToday
              ? myDoctorId
                ? "Your tokens start at T-001 each day."
                : "Each doctor has a separate queue. Tokens restart at T-001 per doctor, per day."
              : `Past OPD for ${dayLabel}. Doctors can review completed visits from previous days.`}{" "}
            {isToday
              ? `Waiting ${waiting} · With doctor ${checkedIn}`
              : `Completed ${completed} · Visits ${queue.length}`}
          </p>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <OpdDayNav action="/queue" dateValue={dateValue} />
          {WALK_IN_ROLES.includes(user.role) && isToday ? (
            <Link href="/appointments/new?walkin=1" className={compactPrimaryButtonClass}>
              Add walk-in
            </Link>
          ) : null}
        </div>
      </div>

      <div className="space-y-6">
        {doctorQueues.length === 0 ? (
          <p className="rounded-xl border border-border bg-surface p-5 text-sm text-text-secondary shadow-card">
            No patients in {isToday ? "today's" : "this day's"} OPD queue.
          </p>
        ) : (
          doctorQueues.map((group) => (
            <section key={group.doctorId} className="min-w-0">
              <div className="mb-2.5 flex flex-wrap items-end justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-[15px] font-semibold text-text-primary 2xl:text-base">
                    {doctorName(group.doctor)}
                  </h3>
                  <p className="text-[11px] text-text-secondary 2xl:text-xs">
                    {isToday
                      ? `Waiting ${group.waiting} · With doctor ${group.inConsult} · Today ${group.items.length} · Next token ${tokenLabel(group.lastToken + 1)}`
                      : `Completed ${group.items.filter((row) => row.status === "COMPLETED").length} · Visits ${group.items.length}`}
                  </p>
                </div>
              </div>

              {group.items.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border bg-surface p-4 text-sm text-text-secondary">
                  No patients for this doctor {isToday ? "yet. The first check-in gets T-001." : "on this date."}
                </p>
              ) : (
                <div className="grid min-w-0 gap-2.5 xl:grid-cols-2 2xl:grid-cols-3">
                  {group.items.map((row) => (
                    <article
                      key={row.id}
                      className="min-w-0 rounded-xl border border-border bg-surface p-3 shadow-card"
                    >
                      <div className="flex min-w-0 items-start justify-between gap-2">
                        <div className="flex min-w-0 gap-2.5">
                          {row.patient.photoData ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={row.patient.photoData}
                              alt=""
                              className="h-12 w-12 shrink-0 rounded-lg object-cover"
                            />
                          ) : null}
                          <div className="min-w-0">
                            <p className="text-base font-semibold text-text-primary">
                              {tokenLabel(row.tokenNumber)}
                            </p>
                            <p className="truncate text-[13px] font-medium">
                              <Link
                                className="text-primary hover:underline"
                                href={`/patients/${row.patient.id}`}
                              >
                                {patientName(row.patient)}
                              </Link>
                            </p>
                            <p className="truncate text-[11px] text-text-secondary">
                              {row.scheduledAt.toLocaleTimeString("en-IN", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}{" "}
                              · {row.department.name}
                            </p>
                            <p className="mt-0.5 truncate text-[11px] text-text-secondary">
                              {prettyEnum(row.queueType)} · {prettyEnum(row.visitType)} ·{" "}
                              {prettyEnum(row.referralSource)}
                              {row.checkInAt
                                ? ` · In ${row.checkInAt.toLocaleTimeString("en-IN", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}`
                                : ""}
                              {row.checkOutAt
                                ? ` · Out ${row.checkOutAt.toLocaleTimeString("en-IN", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}`
                                : ""}
                            </p>
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              <span
                                className={`${statusBadgeBase} ${
                                  row.vitals ? statusBadge.success : statusBadge.warning
                                }`}
                              >
                                {row.vitals ? "Vitals recorded" : "Waiting for vitals"}
                              </span>
                              <span
                                className={`${statusBadgeBase} ${
                                  row.assessment?.status === "APPROVED"
                                    ? statusBadge.success
                                    : statusBadge.warning
                                }`}
                              >
                                {row.assessment?.status === "APPROVED"
                                  ? "Summary approved"
                                  : row.assessment
                                    ? "Assessment draft"
                                    : "Assessment pending"}
                              </span>
                            </div>
                          </div>
                        </div>
                        <span className={`${statusBadgeBase} ${statusBadge.info} shrink-0`}>
                          {prettyEnum(row.status)}
                        </span>
                      </div>

                      {canDoctorVisit && row.status !== "CANCELLED" ? (
                        <div className="mt-2.5">
                          <DoctorVisitActions
                            id={row.id}
                            status={row.status}
                            summaryApproved={row.assessment?.status === "APPROVED"}
                            assessmentHref={`/appointments/${row.id}`}
                            assessmentLabel={
                              row.assessment?.status === "APPROVED" || row.status === "COMPLETED"
                                ? "View visit"
                                : "Doctor assessment"
                            }
                            summaryHref={
                              row.assessment ? `/appointments/${row.id}/summary` : undefined
                            }
                            summaryLabel={
                              row.assessment?.status === "APPROVED" ? "Print record" : "Preview summary"
                            }
                          />
                        </div>
                      ) : null}

                      {!canDoctorVisit &&
                      canPrintSummary &&
                      row.assessment?.status === "APPROVED" ? (
                        <div className="mt-2.5">
                          <Link href={`/appointments/${row.id}/summary`} className={compactButtonClass}>
                            Print record
                          </Link>
                        </div>
                      ) : null}

                      {canManage && isToday ? (
                        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                          <Link href={`/billing/collect/${row.id}`} className={compactPrimaryButtonClass}>
                            Record payment
                          </Link>
                          <AppointmentActions id={row.id} status={row.status} />
                        </div>
                      ) : null}

                      {canManage && !isToday ? (
                        <Link
                          href={`/appointments/${row.id}`}
                          className="mt-2.5 inline-block text-[13px] text-primary hover:underline"
                        >
                          View visit details
                        </Link>
                      ) : null}

                      {!canDoctorVisit &&
                      !canManage &&
                      canRecordVitals &&
                      isToday &&
                      !row.vitals ? (
                        <Link
                          href={`/appointments/${row.id}`}
                          className="mt-2.5 inline-block text-[13px] font-medium text-primary hover:underline"
                        >
                          Record vitals
                        </Link>
                      ) : null}

                      {!canDoctorVisit &&
                      !canManage &&
                      !(canRecordVitals && isToday && !row.vitals) &&
                      !(canPrintSummary && row.assessment?.status === "APPROVED") ? (
                        <Link
                          href={`/appointments/${row.id}`}
                          className="mt-2.5 inline-block text-[13px] text-primary hover:underline"
                        >
                          View visit details
                        </Link>
                      ) : null}
                    </article>
                  ))}
                </div>
              )}
            </section>
          ))
        )}
      </div>
    </AppShell>
  );
}
