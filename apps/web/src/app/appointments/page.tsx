import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AppointmentActions } from "@/components/appointment-actions";
import { LeaveForm } from "@/components/leave-form";
import { primaryButtonClass, secondaryButtonClass } from "@/components/auth-shell";
import {
  FRONT_DESK_ROLES,
  dayRange,
  doctorName,
  listBookableDoctors,
  localDayKey,
  patientName,
  prettyEnum,
  requireHospitalPage,
  tokenLabel,
} from "@/lib/front-desk";
import { prisma } from "@/lib/prisma";

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; doctorId?: string; departmentId?: string; view?: string }>;
}) {
  const user = await requireHospitalPage();
  if (user.role === "LAB_TECH") redirect("/lab");
  const params = await searchParams;
  const selectedDate = params.date ? new Date(params.date) : new Date();
  const { start, end } = dayRange(Number.isNaN(selectedDate.getTime()) ? new Date() : selectedDate);
  const view = params.view === "calendar" ? "calendar" : "list";

  const [appointments, doctors, departments, leaves] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        hospitalId: user.hospitalId,
        scheduledAt: { gte: start, lt: end },
        ...(params.doctorId ? { doctorId: params.doctorId } : {}),
        ...(params.departmentId ? { departmentId: params.departmentId } : {}),
      },
      orderBy: { scheduledAt: "asc" },
      include: { patient: true, doctor: { include: { appUser: { select: { username: true } } } }, department: true },
    }),
    listBookableDoctors(user.hospitalId),
    prisma.department.findMany({
      where: { hospitalId: user.hospitalId },
      orderBy: { name: "asc" },
    }),
    prisma.staffLeave.findMany({
      where: {
        hospitalId: user.hospitalId,
        status: "APPROVED",
        staff: { role: "DOCTOR" },
        endAt: { gte: start },
        startAt: { lt: end },
      },
      include: { staff: { include: { appUser: { select: { username: true } } } } },
    }),
  ]);

  const dateValue = localDayKey(start);
  const canManage = FRONT_DESK_ROLES.includes(user.role);
  const weekStart = new Date(start);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + index);
    return day;
  });

  const weekAppointments =
    view === "calendar"
      ? await prisma.appointment.findMany({
          where: {
            hospitalId: user.hospitalId,
            scheduledAt: { gte: weekDays[0], lt: new Date(weekDays[6].getTime() + 24 * 60 * 60 * 1000) },
            ...(params.doctorId ? { doctorId: params.doctorId } : {}),
            ...(params.departmentId ? { departmentId: params.departmentId } : {}),
          },
          orderBy: { scheduledAt: "asc" },
          include: { patient: true, doctor: { include: { appUser: { select: { username: true } } } }, department: true },
        })
      : [];

  return (
    <AppShell title="Appointments">
      <div className="mb-4 flex flex-wrap gap-2">
        {canManage ? (
          <>
            <Link href="/appointments/new" className={primaryButtonClass}>
              Book appointment
            </Link>
            <Link href="/appointments/new?walkin=1" className={secondaryButtonClass}>
              Walk-in
            </Link>
            <Link href="/patients/new?next=appointment" className={secondaryButtonClass}>
              Register patient
            </Link>
          </>
        ) : null}
        <Link
          href={`/appointments?view=${view === "calendar" ? "list" : "calendar"}&date=${dateValue}`}
          className={secondaryButtonClass}
        >
          {view === "calendar" ? "List view" : "Calendar view"}
        </Link>
      </div>

      <form className="mb-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-4" action="/appointments">
        <input type="hidden" name="view" value={view} />
        <label className="text-sm font-medium text-slate-700">
          Date
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            type="date"
            name="date"
            defaultValue={dateValue}
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Doctor
          <select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" name="doctorId" defaultValue={params.doctorId ?? ""}>
            <option value="">All doctors</option>
            {doctors.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>
                {doctorName(doctor)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">
          Department
          <select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" name="departmentId" defaultValue={params.departmentId ?? ""}>
            <option value="">All departments</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <button className={secondaryButtonClass} type="submit">
            Filter
          </button>
        </div>
      </form>

      {view === "calendar" ? (
        <div className="grid gap-3 overflow-x-auto pb-2 md:grid-cols-7">
          {weekDays.map((day) => {
            const key = localDayKey(day);
            const rows = weekAppointments.filter((row) => localDayKey(row.scheduledAt) === key);
            return (
              <article key={key} className="min-w-[10rem] rounded-2xl border border-slate-200 bg-white p-3">
                <p className="text-xs font-medium text-slate-500">
                  {day.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                </p>
                <div className="mt-2 space-y-2">
                  {rows.length === 0 ? <p className="text-xs text-slate-400">No visits</p> : null}
                  {rows.map((row) => (
                    <div key={row.id} className="rounded-lg bg-slate-50 p-2 text-xs">
                      <p className="font-medium">
                        <Link className="text-teal-700 hover:underline" href={`/appointments/${row.id}`}>
                          {row.scheduledAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} · {patientName(row.patient)}
                        </Link>
                      </p>
                      <p className="text-slate-500">
                        {doctorName(row.doctor)} · {prettyEnum(row.status)}
                      </p>
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.length === 0 ? (
            <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">No appointments for this day.</p>
          ) : (
            appointments.map((row) => (
              <article key={row.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      <Link className="text-teal-700 hover:underline" href={`/appointments/${row.id}`}>
                        {patientName(row.patient)}
                      </Link>
                      <span className="ml-2 font-mono text-xs text-slate-500">{row.patient.mrn}</span>
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {row.scheduledAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} · {doctorName(row.doctor)} · {row.department.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {prettyEnum(row.queueType)} · {prettyEnum(row.visitType)} · {prettyEnum(row.referralSource)}
                      {row.referredBy ? ` (${row.referredBy})` : ""} · Token {tokenLabel(row.tokenNumber)}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs">{prettyEnum(row.status)}</span>
                </div>
                {canManage ? <AppointmentActions id={row.id} status={row.status} /> : (
                  <Link href={`/appointments/${row.id}`} className="mt-3 inline-block text-sm text-teal-700 hover:underline">
                    View visit details
                  </Link>
                )}
              </article>
            ))
          )}
        </div>
      )}

      <section className="mt-10">
        <h3 className="mb-3 font-semibold">Doctor availability & leave</h3>
        {leaves.length > 0 ? (
          <ul className="mb-4 space-y-1 text-sm text-slate-600">
            {leaves.map((leave) => (
              <li key={leave.id}>
                {doctorName(leave.staff)} · {leave.startAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} – {leave.endAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                {leave.reason ? ` · ${leave.reason}` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-4 text-sm text-slate-500">No leave recorded for this day.</p>
        )}
        {canManage ? (
          <LeaveForm doctors={doctors.map((doctor) => ({ id: doctor.id, label: doctorName(doctor) }))} />
        ) : null}
      </section>
    </AppShell>
  );
}
