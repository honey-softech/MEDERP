import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AppointmentActions } from "@/components/appointment-actions";
import { LeaveForm } from "@/components/leave-form";
import { compactButtonClass, primaryButtonClass, secondaryButtonClass } from "@/components/auth-shell";
import {
  FRONT_DESK_ROLES,
  PATIENT_REGISTER_ROLES,
  WALK_IN_ROLES,
  addCalendarDays,
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

type CalendarView = "week" | "month" | "list";

function parseView(value?: string): CalendarView {
  if (value === "month" || value === "list") return value;
  if (value === "calendar") return "week";
  return "week";
}

function startOfWeek(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, months: number) {
  const next = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const day = Math.min(date.getDate(), daysInMonth(next.getFullYear(), next.getMonth()));
  next.setDate(day);
  return next;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function buildHref(parts: {
  view: CalendarView;
  date: string;
  doctorId?: string;
  departmentId?: string;
}) {
  const query = new URLSearchParams();
  query.set("view", parts.view);
  query.set("date", parts.date);
  if (parts.doctorId) query.set("doctorId", parts.doctorId);
  if (parts.departmentId) query.set("departmentId", parts.departmentId);
  return `/appointments?${query.toString()}`;
}

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; doctorId?: string; departmentId?: string; view?: string }>;
}) {
  const user = await requireHospitalPage();
  if (user.role === "LAB_TECH") redirect("/lab");
  const params = await searchParams;
  const selectedDate = params.date ? new Date(`${params.date}T00:00:00`) : new Date();
  const anchor = Number.isNaN(selectedDate.getTime()) ? new Date() : selectedDate;
  anchor.setHours(0, 0, 0, 0);
  const view = parseView(params.view);
  const dateValue = localDayKey(anchor);

  const weekStart = startOfWeek(anchor);
  const weekDays = Array.from({ length: 7 }, (_, index) => addCalendarDays(weekStart, index));
  const monthStart = startOfMonth(anchor);
  const monthGridStart = startOfWeek(monthStart);
  const monthDays = Array.from({ length: 42 }, (_, index) => addCalendarDays(monthGridStart, index));

  const rangeStart =
    view === "month" ? monthGridStart : view === "week" ? weekStart : dayRange(anchor).start;
  const rangeEnd =
    view === "month"
      ? addCalendarDays(monthGridStart, 42)
      : view === "week"
        ? addCalendarDays(weekStart, 7)
        : dayRange(anchor).end;

  const leaveRangeStart = view === "list" ? dayRange(anchor).start : rangeStart;
  const leaveRangeEnd = view === "list" ? dayRange(anchor).end : rangeEnd;

  const [appointments, doctors, departments, leaves] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        hospitalId: user.hospitalId,
        scheduledAt: { gte: rangeStart, lt: rangeEnd },
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
        endAt: { gte: leaveRangeStart },
        startAt: { lt: leaveRangeEnd },
      },
      include: { staff: { include: { appUser: { select: { username: true } } } } },
    }),
  ]);

  const canManage = FRONT_DESK_ROLES.includes(user.role);
  const filterBase = {
    doctorId: params.doctorId,
    departmentId: params.departmentId,
  };
  const todayKey = localDayKey(new Date());
  const prevWeek = localDayKey(addCalendarDays(anchor, -7));
  const nextWeek = localDayKey(addCalendarDays(anchor, 7));
  const prevMonth = localDayKey(addMonths(anchor, -1));
  const nextMonth = localDayKey(addMonths(anchor, 1));
  const weekLabel = `${weekDays[0].toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${weekDays[6].toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`;
  const monthLabel = monthStart.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  function rowsForDay(day: Date) {
    const key = localDayKey(day);
    return appointments.filter((row) => localDayKey(row.scheduledAt) === key);
  }

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
        ) : WALK_IN_ROLES.includes(user.role) ? (
          <>
            <Link href="/appointments/new?walkin=1" className={primaryButtonClass}>
              Add walk-in
            </Link>
            {PATIENT_REGISTER_ROLES.includes(user.role) ? (
              <Link href="/patients/new?next=walkin" className={secondaryButtonClass}>
                Register patient
              </Link>
            ) : null}
          </>
        ) : null}
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Link
            href={buildHref({ view: "week", date: dateValue, ...filterBase })}
            className={view === "week" ? primaryButtonClass : compactButtonClass}
          >
            Week
          </Link>
          <Link
            href={buildHref({ view: "month", date: dateValue, ...filterBase })}
            className={view === "month" ? primaryButtonClass : compactButtonClass}
          >
            Month
          </Link>
          <Link
            href={buildHref({ view: "list", date: dateValue, ...filterBase })}
            className={view === "list" ? primaryButtonClass : compactButtonClass}
          >
            List
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {view === "month" ? (
            <>
              <Link
                href={buildHref({ view: "month", date: prevMonth, ...filterBase })}
                className={compactButtonClass}
              >
                Previous month
              </Link>
              <Link
                href={buildHref({ view: "month", date: localDayKey(new Date()), ...filterBase })}
                className={compactButtonClass}
              >
                This month
              </Link>
              <Link
                href={buildHref({ view: "month", date: nextMonth, ...filterBase })}
                className={compactButtonClass}
              >
                Next month
              </Link>
            </>
          ) : (
            <>
              <Link
                href={buildHref({ view: view === "list" ? "list" : "week", date: prevWeek, ...filterBase })}
                className={compactButtonClass}
              >
                Previous week
              </Link>
              <Link
                href={buildHref({
                  view: view === "list" ? "list" : "week",
                  date: localDayKey(new Date()),
                  ...filterBase,
                })}
                className={compactButtonClass}
              >
                This week
              </Link>
              <Link
                href={buildHref({ view: view === "list" ? "list" : "week", date: nextWeek, ...filterBase })}
                className={compactButtonClass}
              >
                Next week
              </Link>
            </>
          )}
        </div>

        <p className="w-full text-sm font-semibold text-slate-800 sm:w-auto sm:text-right">
          {view === "month" ? monthLabel : view === "week" ? weekLabel : anchor.toLocaleDateString("en-IN", { dateStyle: "full" })}
        </p>
      </div>

      <form className="mb-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-4" action="/appointments">
        <input type="hidden" name="view" value={view} />
        <label className="text-sm font-medium text-slate-700">
          Jump to date
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

      {view === "week" ? (
        <div className="grid gap-3 overflow-x-auto pb-2 md:grid-cols-7">
          {weekDays.map((day) => {
            const key = localDayKey(day);
            const rows = rowsForDay(day);
            const isToday = key === todayKey;
            return (
              <article
                key={key}
                className={`min-w-[10rem] rounded-2xl border bg-white p-3 ${isToday ? "border-teal-400 ring-1 ring-teal-200" : "border-slate-200"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-xs font-medium ${isToday ? "text-teal-700" : "text-slate-500"}`}>
                    {day.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                  </p>
                  <Link
                    href={buildHref({ view: "list", date: key, ...filterBase })}
                    className="text-[10px] font-medium text-teal-700 hover:underline"
                  >
                    Day
                  </Link>
                </div>
                <div className="mt-2 space-y-2">
                  {rows.length === 0 ? <p className="text-xs text-slate-400">No visits</p> : null}
                  {rows.map((row) => (
                    <div key={row.id} className="rounded-lg bg-slate-50 p-2 text-xs">
                      <p className="font-medium">
                        <Link className="text-teal-700 hover:underline" href={`/appointments/${row.id}`}>
                          {row.scheduledAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} ·{" "}
                          {patientName(row.patient)}
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
      ) : null}

      {view === "month" ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <div className="grid min-w-[56rem] grid-cols-7 border-b border-slate-200 bg-slate-50">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
              <p key={label} className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                {label}
              </p>
            ))}
          </div>
          <div className="grid min-w-[56rem] grid-cols-7">
            {monthDays.map((day) => {
              const key = localDayKey(day);
              const inMonth = day.getMonth() === monthStart.getMonth();
              const rows = rowsForDay(day);
              const isToday = key === todayKey;
              return (
                <div
                  key={key}
                  className={`min-h-[7.5rem] border-b border-r border-slate-100 p-2 ${inMonth ? "bg-white" : "bg-slate-50/70"} ${isToday ? "ring-1 ring-inset ring-teal-300" : ""}`}
                >
                  <div className="mb-1 flex items-center justify-between gap-1">
                    <Link
                      href={buildHref({ view: "week", date: key, ...filterBase })}
                      className={`text-xs font-semibold ${inMonth ? "text-slate-800" : "text-slate-400"} ${isToday ? "text-teal-700" : ""}`}
                    >
                      {day.getDate()}
                    </Link>
                    {rows.length > 0 ? (
                      <span className="rounded-full bg-teal-50 px-1.5 text-[10px] font-medium text-teal-800">
                        {rows.length}
                      </span>
                    ) : null}
                  </div>
                  <div className="space-y-1">
                    {rows.slice(0, 3).map((row) => (
                      <Link
                        key={row.id}
                        href={`/appointments/${row.id}`}
                        className="block truncate rounded bg-slate-50 px-1.5 py-0.5 text-[10px] text-teal-800 hover:bg-teal-50"
                      >
                        {row.scheduledAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}{" "}
                        {patientName(row.patient)}
                      </Link>
                    ))}
                    {rows.length > 3 ? (
                      <Link
                        href={buildHref({ view: "list", date: key, ...filterBase })}
                        className="block text-[10px] font-medium text-slate-500 hover:text-teal-700"
                      >
                        +{rows.length - 3} more
                      </Link>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {view === "list" ? (
        <div className="space-y-3">
          {appointments.length === 0 ? (
            <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
              No appointments for this day.
            </p>
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
                      {row.scheduledAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} ·{" "}
                      {doctorName(row.doctor)} · {row.department.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {prettyEnum(row.queueType)} · {prettyEnum(row.visitType)} · {prettyEnum(row.referralSource)}
                      {row.referredBy ? ` (${row.referredBy})` : ""} · Token {tokenLabel(row.tokenNumber)}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs">{prettyEnum(row.status)}</span>
                </div>
                {canManage ? (
                  <AppointmentActions id={row.id} status={row.status} />
                ) : (
                  <Link href={`/appointments/${row.id}`} className="mt-3 inline-block text-sm text-teal-700 hover:underline">
                    View visit details
                  </Link>
                )}
              </article>
            ))
          )}
        </div>
      ) : null}

      <section className="mt-10">
        <h3 className="mb-3 font-semibold">Doctor availability & leave</h3>
        {leaves.length > 0 ? (
          <ul className="mb-4 space-y-1 text-sm text-slate-600">
            {leaves.map((leave) => (
              <li key={leave.id}>
                {doctorName(leave.staff)} ·{" "}
                {leave.startAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} –{" "}
                {leave.endAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                {leave.reason ? ` · ${leave.reason}` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-4 text-sm text-slate-500">
            No leave recorded for this {view === "month" ? "month" : view === "week" ? "week" : "day"}.
          </p>
        )}
        {canManage ? (
          <LeaveForm doctors={doctors.map((doctor) => ({ id: doctor.id, label: doctorName(doctor) }))} />
        ) : null}
      </section>
    </AppShell>
  );
}
