import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { AppointmentActions } from "@/components/appointment-actions";
import { DoctorVisitActions } from "@/components/doctor-visit-actions";
import { primaryButtonClass, secondaryButtonClass } from "@/components/auth-shell";
import { OpdDayNav } from "@/components/opd-day-nav";
import {
  DOCTOR_VISIT_ROLES,
  FRONT_DESK_ROLES,
  NURSE_VITALS_ROLES,
  PRINT_SUMMARY_ROLES,
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
import { prisma } from "@/lib/prisma";

export default async function QueuePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const user = await requireHospitalPage();
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
    <AppShell title={myDoctorId ? "My OPD queue" : "OPD queue"}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">
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
        <div className="flex flex-wrap items-end gap-2">
          <OpdDayNav action="/queue" dateValue={dateValue} />
          {canManage && isToday ? (
            <Link href="/appointments/new?walkin=1" className={primaryButtonClass}>
              Add walk-in
            </Link>
          ) : null}
        </div>
      </div>
      <div className="space-y-8">
        {doctorQueues.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            No patients in {isToday ? "today's" : "this day's"} OPD queue.
          </p>
        ) : (
          doctorQueues.map((group) => (
            <section key={group.doctorId}>
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{doctorName(group.doctor)}</h3>
                  <p className="text-xs text-slate-500">
                    {isToday
                      ? `Waiting ${group.waiting} · With doctor ${group.inConsult} · Today ${group.items.length} · Next token ${tokenLabel(group.lastToken + 1)}`
                      : `Completed ${group.items.filter((row) => row.status === "COMPLETED").length} · Visits ${group.items.length}`}
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                {group.items.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-5 text-sm text-slate-500">
                    No patients for this doctor {isToday ? "yet. The first check-in gets T-001." : "on this date."}
                  </p>
                ) : (
                  group.items.map((row) => (
                    <article key={row.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex gap-3">
                          {row.patient.photoData ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={row.patient.photoData}
                              alt=""
                              className="h-14 w-14 rounded-xl object-cover"
                            />
                          ) : null}
                          <div>
                            <p className="text-lg font-semibold">{tokenLabel(row.tokenNumber)}</p>
                            <p className="font-medium">
                              <Link className="text-teal-700 hover:underline" href={`/appointments/${row.id}`}>
                                {patientName(row.patient)}
                              </Link>
                            </p>
                            <p className="text-sm text-slate-500">
                              {row.scheduledAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} · {row.department.name}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {prettyEnum(row.queueType)} · {prettyEnum(row.visitType)} · {prettyEnum(row.referralSource)}
                              {row.checkInAt
                                ? ` · In ${row.checkInAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`
                                : ""}
                              {row.checkOutAt
                                ? ` · Out ${row.checkOutAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`
                                : ""}
                            </p>
                            <p className={`mt-1 text-xs font-medium ${row.vitals ? "text-teal-700" : "text-amber-700"}`}>
                              {row.vitals ? "Nurse vitals recorded" : "Waiting for nurse vitals"}
                            </p>
                            <p className={`mt-1 text-xs font-medium ${row.assessment?.status === "APPROVED" ? "text-teal-700" : "text-amber-700"}`}>
                              {row.assessment?.status === "APPROVED"
                                ? "Visit summary approved"
                                : row.assessment
                                  ? "Doctor assessment draft"
                                  : "Doctor assessment pending"}
                            </p>
                          </div>
                        </div>
                        <span className="rounded-full bg-teal-50 px-3 py-1 text-xs text-teal-800">{prettyEnum(row.status)}</span>
                      </div>
                      {(canDoctorVisit && row.status !== "CANCELLED") ||
                      (canPrintSummary && row.assessment?.status === "APPROVED") ||
                      (canDoctorVisit && row.assessment) ? (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {canDoctorVisit && row.status !== "CANCELLED" ? (
                            <Link href={`/appointments/${row.id}`} className={primaryButtonClass}>
                              {row.assessment?.status === "APPROVED" ? "View assessment" : "Doctor assessment"}
                            </Link>
                          ) : null}
                          {row.assessment &&
                          ((canDoctorVisit && row.assessment) ||
                            (canPrintSummary && row.assessment.status === "APPROVED")) ? (
                            <Link href={`/appointments/${row.id}/summary`} className={secondaryButtonClass}>
                              {row.assessment.status === "APPROVED" ? "Print record" : "Preview summary"}
                            </Link>
                          ) : null}
                        </div>
                      ) : null}
                      {canManage && isToday ? (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <Link href={`/billing/collect/${row.id}`} className={primaryButtonClass}>
                            Record payment
                          </Link>
                          <AppointmentActions id={row.id} status={row.status} />
                        </div>
                      ) : canManage && !isToday ? (
                        <Link href={`/appointments/${row.id}`} className="mt-3 inline-block text-sm text-teal-700 hover:underline">
                          View visit details
                        </Link>
                      ) : canDoctorVisit ? (
                        <DoctorVisitActions
                          id={row.id}
                          status={row.status}
                          summaryApproved={row.assessment?.status === "APPROVED"}
                        />
                      ) : canRecordVitals && isToday && !row.vitals ? (
                        <Link href={`/appointments/${row.id}`} className="mt-3 inline-block text-sm font-medium text-teal-700 hover:underline">
                          Record vitals
                        </Link>
                      ) : (
                        <Link href={`/appointments/${row.id}`} className="mt-3 inline-block text-sm text-teal-700 hover:underline">
                          View visit details
                        </Link>
                      )}
                    </article>
                  ))
                )}
              </div>
            </section>
          ))
        )}
      </div>
    </AppShell>
  );
}
