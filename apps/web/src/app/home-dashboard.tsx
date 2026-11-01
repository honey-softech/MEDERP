import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { FilterableTable } from "@/components/filterable-table";
import { WelcomeBanner } from "@/components/welcome-banner";
import { BoardChat } from "@/components/board-chat";
import { getCurrentUser, isPlatformRole } from "@/lib/auth";
import { listAnnouncements } from "@/lib/board";
import { hospitalHasActivePaidSubscription, trialDaysRemaining } from "@/lib/hospital-access";
import { OpdDayNav } from "@/components/opd-day-nav";
import {
  addCalendarDays,
  dayRange,
  doctorName,
  groupByDoctor,
  humanizeLoginHandle,
  inr,
  listBookableDoctors,
  localDayKey,
  parseLocalDay,
  patientName,
  prettyEnum,
  staffIdForAppUser,
  tokenLabel,
} from "@/lib/front-desk";
import { prisma } from "@/lib/prisma";
import { compactPrimaryButtonClass } from "@/lib/ui";
import { resolveViewContext } from "@/lib/view-mode";
import type { AppRole } from "@prisma/client";

function versusYesterday(today: number, yesterday: number, format: (value: number) => string = String) {
  const delta = today - yesterday;
  if (delta > 0) return `+${format(delta)} vs yesterday`;
  if (delta < 0) return `−${format(Math.abs(delta))} vs yesterday`;
  return `${format(0)} vs yesterday`;
}

function titleCaseName(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function prettyName(
  user: { username: string; firstName?: string | null; lastName?: string | null; role: AppRole },
  asDoctor = false,
) {
  if (user.role === "DOCTOR" || asDoctor) {
    const labeled = doctorName({
      firstName: user.firstName,
      lastName: user.lastName,
      appUser: { username: user.username, firstName: user.firstName, lastName: user.lastName },
    });
    const name = labeled.replace(/^dr\.?\s+/i, "").trim();
    const titled = titleCaseName(name);
    return titled ? `Dr. ${titled}` : labeled;
  }
  const fromAccount = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  const source = fromAccount || user.username;
  const cleaned = (source.includes(" ") ? source : humanizeLoginHandle(source) || source)
    .replace(/[._]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return titleCaseName(cleaned);
}

function bannerCopy(
  role: AppRole,
  hospitalName?: string | null,
  asDoctor = false,
  nurseAsReceptionist = false,
) {
  if (role === "SOFTWARE_ADMIN") {
    return {
      locationTitle: "Platform administration",
      locationSubtitle: "MedERP SaaS console",
    };
  }
  if (role === "HELPDESK") {
    return {
      locationTitle: "Helpdesk",
      locationSubtitle: "MedERP support desk",
    };
  }
  if (asDoctor || role === "DOCTOR") {
    return {
      locationTitle: "Clinical care",
      locationSubtitle: hospitalName ?? "Your hospital",
    };
  }
  if (role === "SUPER_ADMIN") {
    return {
      locationTitle: "Hospital administration",
      locationSubtitle: hospitalName ?? "Your hospital",
    };
  }
  if (role === "RECEPTIONIST" || (role === "NURSE" && nurseAsReceptionist)) {
    return {
      locationTitle: "Reception",
      locationSubtitle: hospitalName ?? "Your hospital",
    };
  }
  return {
    locationTitle: role.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()),
    locationSubtitle: hospitalName ?? "Your hospital",
  };
}

export async function HomeDashboard({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  const view = await resolveViewContext(user);
  const asDoctor = view.canActAsDoctor && view.mode === "doctor";
  const copy = bannerCopy(
    user?.role ?? "RECEPTIONIST",
    user?.hospital?.name,
    asDoctor,
    Boolean(user?.hospital?.nurseAsReceptionist),
  );
  const { date } = await searchParams;
  const selectedDay = parseLocalDay(date);
  const { start, end } = dayRange(selectedDay);
  const dateValue = localDayKey(start);
  const todayKey = localDayKey(new Date());
  const isToday = dateValue === todayKey;
  const queueHref = isToday ? "/queue" : `/queue?date=${dateValue}`;
  const dayLabel = start.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const platformStats =
    user?.role === "SOFTWARE_ADMIN"
      ? await Promise.all([
          prisma.hospital.count(),
          prisma.appUser.count({ where: { role: { notIn: ["SOFTWARE_ADMIN", "HELPDESK"] } } }),
          prisma.helpdeskTicket.count({
            where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING_REPLY", "ESCALATED"] } },
          }),
          prisma.helpdeskTicket.count({ where: { status: "ESCALATED" } }),
        ]).then(([hospitals, users, openTickets, escalatedTickets]) => [
          { label: "Hospitals", value: String(hospitals), href: "/platform/hospitals" },
          { label: "Hospital users", value: String(users), href: "/platform/users" },
          { label: "Open helpdesk", value: String(openTickets), href: "/helpdesk" },
          { label: "Escalated", value: String(escalatedTickets), href: "/helpdesk" },
        ])
      : user?.role === "HELPDESK"
        ? await prisma.helpdeskTicket
            .count({
              where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING_REPLY", "ESCALATED"] } },
            })
            .then((openTickets) => [
              { label: "Open helpdesk", value: String(openTickets), href: "/helpdesk" },
            ])
        : null;

  const escalatedHelpdeskTickets =
    user?.role === "SOFTWARE_ADMIN"
      ? await prisma.helpdeskTicket.findMany({
          where: { status: "ESCALATED" },
          orderBy: { escalatedAt: "desc" },
          take: 8,
          include: {
            hospital: { select: { name: true, code: true } },
            createdBy: { select: { username: true, role: true } },
            escalatedBy: { select: { username: true } },
          },
        })
      : [];

  const openHelpdeskTickets =
    user?.role === "SOFTWARE_ADMIN" || user?.role === "HELPDESK"
      ? await prisma.helpdeskTicket.findMany({
          where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING_REPLY", "ESCALATED"] } },
          orderBy: { updatedAt: "desc" },
          take: 8,
          include: {
            hospital: { select: { name: true, code: true } },
            createdBy: { select: { username: true, role: true } },
          },
        })
      : [];

  const pendingJoins =
    user?.role === "SUPER_ADMIN" && user.hospitalId && !asDoctor
      ? await prisma.hospitalJoinRequest.count({
          where: { hospitalId: user.hospitalId, status: "PENDING" },
        })
      : 0;
  const pendingLeaves =
    user?.role === "SUPER_ADMIN" && user.hospitalId && !asDoctor
      ? await prisma.staffLeave.count({
          where: { hospitalId: user.hospitalId, status: "PENDING" },
        })
      : 0;
  const boardPosts =
    user?.hospitalId && !isPlatformRole(user.role)
      ? await listAnnouncements(user.hospitalId, { take: 40, includeReplies: false })
      : [];
  const myDoctorId =
    user?.hospitalId && (user.role === "DOCTOR" || asDoctor)
      ? asDoctor
        ? view.doctorStaffId
        : await staffIdForAppUser(user.id, user.hospitalId)
      : null;
  const yesterdayRange = dayRange(addCalendarDays(new Date(), -1));
  const todayRange = dayRange(new Date());

  const hospitalStats =
    user?.hospitalId && !platformStats
      ? await Promise.all([
          prisma.patient.count({
            where: {
              hospitalId: user.hospitalId,
              createdAt: { gte: todayRange.start, lt: todayRange.end },
              mergedIntoId: null,
            },
          }),
          prisma.appointment.count({
            where: {
              hospitalId: user.hospitalId,
              scheduledAt: { gte: todayRange.start, lt: todayRange.end },
              status: { not: "CANCELLED" },
              ...(myDoctorId ? { doctorId: myDoctorId } : {}),
            },
          }),
          prisma.appointment.count({
            where: {
              hospitalId: user.hospitalId,
              scheduledAt: { gte: todayRange.start, lt: todayRange.end },
              status: { in: ["CHECKED_IN", "IN_PROGRESS"] },
              ...(myDoctorId ? { doctorId: myDoctorId } : {}),
            },
          }),
          prisma.payment.aggregate({
            where: {
              hospitalId: user.hospitalId,
              receivedAt: { gte: todayRange.start, lt: todayRange.end },
              kind: { not: "REFUND" },
            },
            _sum: { amount: true },
          }),
          prisma.patient.count({
            where: {
              hospitalId: user.hospitalId,
              createdAt: { gte: yesterdayRange.start, lt: yesterdayRange.end },
              mergedIntoId: null,
            },
          }),
          prisma.appointment.count({
            where: {
              hospitalId: user.hospitalId,
              scheduledAt: { gte: yesterdayRange.start, lt: yesterdayRange.end },
              status: { not: "CANCELLED" },
              ...(myDoctorId ? { doctorId: myDoctorId } : {}),
            },
          }),
          prisma.appointment.count({
            where: {
              hospitalId: user.hospitalId,
              scheduledAt: { gte: todayRange.start, lt: todayRange.end },
              status: "SCHEDULED",
              ...(myDoctorId ? { doctorId: myDoctorId } : {}),
            },
          }),
          prisma.payment.aggregate({
            where: {
              hospitalId: user.hospitalId,
              receivedAt: { gte: yesterdayRange.start, lt: yesterdayRange.end },
              kind: { not: "REFUND" },
            },
            _sum: { amount: true },
          }),
        ]).then(
          ([
            patients,
            appointments,
            withDoctor,
            collections,
            yPatients,
            yAppointments,
            waiting,
            yCollections,
          ]) => [
            {
              label: myDoctorId ? "In my OPD now" : "In OPD now",
              value: String(waiting + withDoctor),
              detail: `${waiting} waiting · ${withDoctor} with doctor`,
              href: queueHref,
            },
            {
              label: myDoctorId ? "My appointments today" : "Appointments today",
              value: String(appointments),
              detail: versusYesterday(appointments, yAppointments),
              href: queueHref,
            },
            {
              label: "Collections today",
              value: inr(collections._sum.amount ?? 0),
              detail: versusYesterday(
                Number(collections._sum.amount ?? 0),
                Number(yCollections._sum.amount ?? 0),
                (amount) => inr(amount),
              ),
              href: "/billing/collections",
            },
            {
              label: "New registrations",
              value: String(patients),
              detail: versusYesterday(patients, yPatients),
              href: "/patients",
            },
          ],
        )
      : null;

  const [queue, doctors] =
    user?.hospitalId && !isPlatformRole(user.role)
      ? await Promise.all([
          prisma.appointment.findMany({
            where: {
              hospitalId: user.hospitalId,
              scheduledAt: { gte: start, lt: end },
              status: isToday ? { notIn: ["CANCELLED", "COMPLETED"] } : { not: "CANCELLED" },
              ...(myDoctorId ? { doctorId: myDoctorId } : {}),
            },
            orderBy: [{ tokenNumber: "asc" }, { scheduledAt: "asc" }],
            include: {
              patient: true,
              department: true,
              doctor: { include: { appUser: { select: { username: true, firstName: true, lastName: true } } } },
              vitals: { select: { id: true } },
            },
          }),
          listBookableDoctors(user.hospitalId),
        ])
      : [[], []];

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

  const showBoard = Boolean(user?.hospitalId && !isPlatformRole(user.role));
  const showQueue = Boolean(showBoard && user?.role !== "LAB_TECH");

  return (
    <AppShell title="Dashboard">
      {user && !showBoard ? (
        <WelcomeBanner
          displayName={prettyName(user, asDoctor)}
          locationTitle={copy.locationTitle}
          locationSubtitle={copy.locationSubtitle}
          className="mb-5"
        />
      ) : null}

      {escalatedHelpdeskTickets.length > 0 && user?.role === "SOFTWARE_ADMIN" ? (
        <section className="home-panel mb-4 border-[#f0c9c9] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-red-950">
                {escalatedHelpdeskTickets.length} escalated ticket
                {escalatedHelpdeskTickets.length === 1 ? "" : "s"}
              </h3>
              <p className="mt-1 text-sm text-red-900">
                Helpdesk asked for software-admin tools (hospital access, seats, trial, merge, or code).
              </p>
            </div>
            <Link href="/helpdesk" className="text-sm font-medium text-teal-800 hover:underline">
              Open helpdesk →
            </Link>
          </div>
          <ul className="mt-4 space-y-2">
            {escalatedHelpdeskTickets.map((ticket) => (
              <li key={ticket.id}>
                <Link
                  href={`/helpdesk/${ticket.id}`}
                  className="block rounded-2xl border border-[#f3d4d4] bg-[#fff8f8] px-4 py-3 hover:border-[#d32f2f]"
                >
                  <p className="font-medium text-slate-900">
                    {ticket.number} · {ticket.subject}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {ticket.hospital ? `${ticket.hospital.name} · ` : ""}
                    from {ticket.createdBy?.username ?? ticket.contactName ?? ticket.contactMobile ?? "Unknown"}
                    {ticket.escalatedBy?.username ? ` · escalated by ${ticket.escalatedBy.username}` : ""}
                    {ticket.escalationReason ? ` · ${ticket.escalationReason.slice(0, 80)}` : ""}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {openHelpdeskTickets.length > 0 && (user?.role === "SOFTWARE_ADMIN" || user?.role === "HELPDESK") ? (
        <section className="home-panel mb-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-violet-950">
                {openHelpdeskTickets.length} open helpdesk ticket{openHelpdeskTickets.length === 1 ? "" : "s"}
              </h3>
              <p className="mt-1 text-sm text-violet-900">
                Hospital support requests appear here and under Helpdesk — not under Join requests.
              </p>
            </div>
            <Link href="/helpdesk" className="text-sm font-medium text-teal-800 hover:underline">
              Open helpdesk →
            </Link>
          </div>
          <ul className="mt-4 space-y-2">
            {openHelpdeskTickets.map((ticket) => (
              <li key={ticket.id}>
                <Link
                  href={`/helpdesk/${ticket.id}`}
                  className="block rounded-2xl border border-[#e3eaf2] bg-[#f7fafc] px-4 py-3 hover:border-[#1976d2]"
                >
                  <p className="font-medium text-slate-900">
                    {ticket.number} · {ticket.subject}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {ticket.hospital ? `${ticket.hospital.name} · ` : ""}
                    from {ticket.createdBy?.username ?? ticket.contactName ?? ticket.contactMobile ?? "Unknown"} ·{" "}
                    {ticket.status.replace(/_/g, " ").toLowerCase()}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {showBoard && user ? (
        <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="flex min-w-0 flex-col gap-4">
            <WelcomeBanner
              displayName={prettyName(user, asDoctor)}
              locationTitle={copy.locationTitle}
              locationSubtitle={copy.locationSubtitle}
              actions={
                showQueue
                  ? [
                      { href: "/patients/new", label: "Register patient" },
                      { href: "/appointments/new", label: "Book appointment" },
                      { href: queueHref, label: "Open OPD", primary: true },
                    ]
                  : []
              }
            />
            <section className="grid flex-1 gap-3 sm:grid-cols-2">
              {(hospitalStats ?? []).map((stat) => {
                const detail = "detail" in stat && typeof stat.detail === "string" ? stat.detail : "";
                const card = (
                  <>
                    <p className="home-stat-kicker">{stat.label}</p>
                    <p className="home-stat-value">{stat.value}</p>
                    {detail ? <p className="mt-3 text-xs text-[#7b8ba0]">{detail}</p> : null}
                  </>
                );
                return (
                  <Link key={stat.label} href={stat.href} className="home-stat transition hover:border-[#1976d2]">
                    {card}
                  </Link>
                );
              })}
            </section>
          </div>
          <BoardChat posts={boardPosts} currentUserId={user.id} />
        </div>
      ) : (
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {(platformStats ?? hospitalStats ?? []).map((stat) => {
          const detail = "detail" in stat && typeof stat.detail === "string" ? stat.detail : "";
          const card = (
            <>
              <p className="home-stat-kicker">{stat.label}</p>
              <p className="home-stat-value">{stat.value}</p>
              {detail ? <p className="mt-3 text-xs text-[#7b8ba0]">{detail}</p> : null}
            </>
          );
          const href = "href" in stat ? stat.href : undefined;
          return href ? (
            <Link key={stat.label} href={href} className="home-stat transition hover:border-[#1976d2]">
              {card}
            </Link>
          ) : (
            <article key={stat.label} className="home-stat">
              {card}
            </article>
          );
        })}
      </section>
      )}

      {openHelpdeskTickets.length > 0 && (user?.role === "SOFTWARE_ADMIN" || user?.role === "HELPDESK") ? (
        <section className="mt-6 sm:mt-8">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="font-semibold">Helpdesk queue</h3>
            <Link href="/helpdesk" className="text-sm font-medium text-teal-700 hover:underline">
              View all
            </Link>
          </div>
          <div className="[&>div]:rounded-3xl [&>div]:border [&>div]:border-[#e6eaf0] [&>div]:bg-white [&>div]:shadow-[0_16px_40px_-32px_rgb(11_28_51_/_0.55)]">
            <FilterableTable
              empty="No open tickets."
              rows={openHelpdeskTickets.map((ticket) => ({
                id: ticket.id,
                number: ticket.number,
                subject: ticket.subject,
                hospital: ticket.hospital?.name ?? "Platform",
                from: ticket.createdBy?.username ?? ticket.contactName ?? ticket.contactMobile ?? "Unknown",
                status: ticket.status.replace(/_/g, " "),
                updated: ticket.updatedAt.toLocaleString("en-IN"),
                href: `/helpdesk/${ticket.id}`,
              }))}
              columns={[
                { key: "number", header: "Ticket", className: "font-mono text-xs", hrefKey: "href" },
                { key: "subject", header: "Subject", className: "font-medium", hrefKey: "href" },
                { key: "hospital", header: "Hospital" },
                { key: "from", header: "From" },
                { key: "status", header: "Status" },
                { key: "updated", header: "Updated" },
              ]}
            />
          </div>
        </section>
      ) : null}

      {user && !user.hospitalId && !isPlatformRole(user.role) ? (
        <section className="home-panel mt-6 border-[#ead7a4] bg-[#fffaf0] p-5 sm:mt-8">
          <h3 className="font-semibold text-amber-950">Join a listed hospital</h3>
          <p className="mt-1 text-sm text-amber-900">
            Your account is ready, but you are not on a hospital yet. Pick a listed hospital and wait for the
            super admin to approve you. You cannot add yourself directly.
          </p>
          <Link href="/join" className="mt-3 inline-flex text-sm font-medium text-teal-800 hover:underline">
            Request to join →
          </Link>
        </section>
      ) : null}

      {showBoard && user ? (
        <div className="mt-6 space-y-4 sm:mt-8">
          {user.hospital?.trialEndsAt && !hospitalHasActivePaidSubscription(user.hospital.subscription) ? (
            <section className="home-panel p-5">
              <h3 className="font-semibold text-teal-950">
                {trialDaysRemaining(user.hospital.trialEndsAt) === 0
                  ? "Free trial ended"
                  : `${trialDaysRemaining(user.hospital.trialEndsAt)} day${trialDaysRemaining(user.hospital.trialEndsAt) === 1 ? "" : "s"} left on your free trial`}
              </h3>
              <p className="mt-1 text-sm text-teal-900">
                Your clinic can use the selected plan until{" "}
                {user.hospital.trialEndsAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}. Link payment on
                Subscription before then so auto-debit continues after the trial.
              </p>
              {user.role === "SUPER_ADMIN" ? (
                <Link href="/hospital/subscription" className="mt-3 inline-flex text-sm font-medium text-teal-800 hover:underline">
                  Open subscription →
                </Link>
              ) : null}
            </section>
          ) : null}

          {pendingJoins > 0 ? (
            <section className="home-panel p-5">
              <h3 className="font-semibold text-teal-950">
                {pendingJoins} staff join request{pendingJoins === 1 ? "" : "s"} waiting
              </h3>
              <p className="mt-1 text-sm text-teal-900">
                People signed up and asked to join this hospital. Approve them before they can work here.
              </p>
              <Link href="/hospital/join-requests" className="mt-3 inline-flex text-sm font-medium text-teal-800 hover:underline">
                Review join requests →
              </Link>
            </section>
          ) : null}

          {pendingLeaves > 0 ? (
            <section className="home-panel border-[#ead7a4] bg-[#fffaf0] p-5">
              <h3 className="font-semibold text-amber-950">
                {pendingLeaves} leave request{pendingLeaves === 1 ? "" : "s"} waiting
              </h3>
              <p className="mt-1 text-sm text-amber-900">
                Doctors, nurses, and other staff have applied for leave. Approve or reject them here.
              </p>
              <Link href="/hospital/leaves" className="mt-3 inline-flex text-sm font-medium text-amber-800 hover:underline">
                Review staff leave →
              </Link>
            </section>
          ) : null}

          {showQueue ? (
            <section className="min-w-0 space-y-6">
              <div>
                <h3 className="font-semibold">
                  {myDoctorId ? "My OPD queue" : "OPD queue by doctor"}
                  {!isToday ? ` · ${dayLabel}` : ""}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  {isToday
                    ? "Live queue for today. Open a previous day to review past OPD tokens."
                    : "Past OPD for this date, including completed visits."}
                </p>
                <div className="mt-3">
                  <OpdDayNav action="/" dateValue={dateValue} />
                </div>
              </div>
              {doctorQueues.length === 0 ? (
                <p className="home-panel p-6 text-sm text-slate-500">
                  {isToday ? "No doctor queues to show yet." : `No OPD visits on ${dayLabel}.`}
                </p>
              ) : (
                doctorQueues.map((group) => {
                  const oneDepartment = new Set(group.items.map((row) => row.department.name)).size <= 1;
                  return (
                    <div key={group.doctorId} className="home-panel overflow-hidden">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
                        <div>
                          <p className="font-semibold">{doctorName(group.doctor)}</p>
                          <p className="text-xs text-slate-500">
                            {isToday
                              ? `Waiting ${group.waiting} · With doctor ${group.inConsult} · Today ${group.items.length} · Next token ${tokenLabel(group.lastToken + 1)}`
                              : `Completed ${group.items.filter((row) => row.status === "COMPLETED").length} · Visits ${group.items.length}`}
                          </p>
                        </div>
                        <Link href={queueHref} className={compactPrimaryButtonClass}>
                          Open OPD
                        </Link>
                      </div>
                      {group.items.length === 0 ? (
                        <div className="px-4 py-6 sm:px-5">
                          <p className="text-sm text-slate-500">
                            {isToday
                              ? "No patients in this queue yet."
                              : "No patients in this doctor's OPD on this date."}
                          </p>
                          <Link href="/patients/new" className={`${compactPrimaryButtonClass} mt-3`}>
                            Register patient
                          </Link>
                        </div>
                      ) : (
                        <div className="[&>div]:rounded-none [&>div]:border-0 [&>div]:shadow-none">
                          <FilterableTable
                            rows={group.items.map((row) => ({
                              id: row.id,
                              token: tokenLabel(row.tokenNumber),
                              time: row.scheduledAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
                              patient: patientName(row.patient),
                              department: row.department.name,
                              status: prettyEnum(row.status),
                              vitals: row.vitals ? "Recorded" : "Pending",
                            }))}
                            columns={[
                              { key: "token", header: "Token" },
                              { key: "time", header: "Time" },
                              { key: "patient", header: "Patient", className: "font-medium" },
                              ...(oneDepartment ? [] : [{ key: "department", header: "Department" }]),
                              { key: "status", header: "Status" },
                              { key: "vitals", header: "Vitals" },
                            ]}
                          />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </section>
          ) : (
            <section className="home-panel p-5">
              <h3 className="font-semibold">Laboratory</h3>
              <p className="mt-1 text-sm text-slate-500">
                Paid requests wait here. Upload the report and mark done. The doctor is notified on the patient record.
              </p>
              <Link href="/lab" className="mt-3 inline-flex text-sm font-medium text-teal-700 hover:underline">
                Open laboratory →
              </Link>
            </section>
          )}
        </div>
      ) : null}
    </AppShell>
  );
}
