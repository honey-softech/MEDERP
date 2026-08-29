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
import type { AppRole } from "@prisma/client";

function prettyName(username: string, role: AppRole) {
  const cleaned = username.replace(/[._]/g, " ");
  const titled = cleaned.replace(/\b\w/g, (letter) => letter.toUpperCase());
  if (role === "DOCTOR" && !/^dr\b/i.test(titled)) return `Dr. ${titled}`;
  return titled;
}

function bannerCopy(role: AppRole, hospitalName?: string | null) {
  if (role === "SOFTWARE_ADMIN") {
    return {
      tagline: "Here's what's happening across your hospitals today. Stay aware, stay ahead.",
      locationTitle: "Platform administration",
      locationSubtitle: "MedERP SaaS console",
    };
  }
  if (role === "HELPDESK") {
    return {
      tagline: "Hospital requests land here. Reply and the admin gets a live notification.",
      locationTitle: "Helpdesk",
      locationSubtitle: "MedERP support desk",
    };
  }
  if (role === "SUPER_ADMIN") {
    return {
      tagline: "Here's what's happening in your hospital today. Stay aware, stay ahead.",
      locationTitle: "Hospital administration",
      locationSubtitle: hospitalName ?? "Your hospital",
    };
  }
  if (role === "DOCTOR") {
    return {
      tagline: "Here's what's happening in your practice today. Stay aware, stay ahead.",
      locationTitle: "Clinical care",
      locationSubtitle: hospitalName ?? "Your hospital",
    };
  }
  if (role === "RECEPTIONIST") {
    return {
      tagline: "Here's what's happening at the front desk today. Stay aware, stay ahead.",
      locationTitle: "Reception",
      locationSubtitle: hospitalName ?? "Your hospital",
    };
  }
  return {
    tagline: "Here's what's happening in your hospital today. Stay aware, stay ahead.",
    locationTitle: role.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()),
    locationSubtitle: hospitalName ?? "Your hospital",
  };
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const user = await getCurrentUser();
  const copy = bannerCopy(user?.role ?? "RECEPTIONIST", user?.hospital?.name);
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
    user?.role === "SOFTWARE_ADMIN" || user?.role === "HELPDESK"
      ? await Promise.all([
          prisma.hospital.count(),
          prisma.appUser.count({ where: { role: { notIn: ["SOFTWARE_ADMIN", "HELPDESK"] } } }),
          prisma.helpdeskTicket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING_REPLY"] } } }),
          prisma.hospitalJoinRequest.count({ where: { status: "PENDING" } }),
        ]).then(([hospitals, users, openTickets, joinRequests]) => [
          { label: "Hospitals", value: String(hospitals), href: "/platform/hospitals" },
          { label: "Hospital users", value: String(users), href: "/platform/users" },
          { label: "Open helpdesk", value: String(openTickets), href: "/helpdesk" },
          { label: "Join requests", value: String(joinRequests), href: "/platform/join-requests" },
        ])
      : null;

  const openHelpdeskTickets =
    user?.role === "SOFTWARE_ADMIN" || user?.role === "HELPDESK"
      ? await prisma.helpdeskTicket.findMany({
          where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING_REPLY"] } },
          orderBy: { updatedAt: "desc" },
          take: 8,
          include: {
            hospital: { select: { name: true, code: true } },
            createdBy: { select: { username: true, role: true } },
          },
        })
      : [];

  const pendingJoins =
    user?.role === "SUPER_ADMIN" && user.hospitalId
      ? await prisma.hospitalJoinRequest.count({
          where: { hospitalId: user.hospitalId, status: "PENDING" },
        })
      : 0;
  const pendingLeaves =
    user?.role === "SUPER_ADMIN" && user.hospitalId
      ? await prisma.staffLeave.count({
          where: { hospitalId: user.hospitalId, status: "PENDING" },
        })
      : 0;
  const boardPosts =
    user?.hospitalId && !isPlatformRole(user.role)
      ? await listAnnouncements(user.hospitalId, { take: 40, includeReplies: false })
      : [];
  const myDoctorId =
    user?.role === "DOCTOR" && user.hospitalId
      ? await staffIdForAppUser(user.id, user.hospitalId)
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
              scheduledAt: { gte: yesterdayRange.start, lt: yesterdayRange.end },
              status: "COMPLETED",
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
            inQueue,
            collections,
            yPatients,
            yAppointments,
            yCompleted,
            yCollections,
          ]) => [
            {
              label: "New registrations",
              value: String(patients),
              yesterday: `Yesterday · ${yPatients}`,
            },
            {
              label: myDoctorId ? "My appointments today" : "Appointments today",
              value: String(appointments),
              yesterday: `Yesterday · ${yAppointments}`,
            },
            {
              label: myDoctorId ? "In my OPD now" : "In OPD now",
              value: String(inQueue),
              yesterday: `Yesterday seen · ${yCompleted}`,
            },
            {
              label: "Collections today",
              value: inr(collections._sum.amount ?? 0),
              yesterday: `Yesterday · ${inr(yCollections._sum.amount ?? 0)}`,
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
              doctor: { include: { appUser: { select: { username: true } } } },
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

  return (
    <AppShell title="Dashboard">
      <div
        className={
          showBoard
            ? "mb-6 grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)] xl:grid-cols-[minmax(0,1fr)_28rem]"
            : undefined
        }
      >
        {user ? (
          <WelcomeBanner
            displayName={prettyName(user.username, user.role)}
            tagline={copy.tagline}
            locationTitle={copy.locationTitle}
            locationSubtitle={copy.locationSubtitle}
            compact={showBoard}
            className={showBoard ? "h-full" : undefined}
          />
        ) : null}

        {showBoard && user ? (
          <BoardChat posts={boardPosts} currentUserId={user.id} />
        ) : null}
      </div>

      {user?.hospitalId &&
      user.hospital?.trialEndsAt &&
      !isPlatformRole(user.role) &&
      !hospitalHasActivePaidSubscription(user.hospital.subscription) ? (
        <section className="mb-6 rounded-2xl border border-teal-200 bg-teal-50 p-5">
          <h3 className="font-semibold text-teal-950">
            {trialDaysRemaining(user.hospital.trialEndsAt) === 0
              ? "Free trial ended"
              : `${trialDaysRemaining(user.hospital.trialEndsAt)} day${trialDaysRemaining(user.hospital.trialEndsAt) === 1 ? "" : "s"} left on your free trial`}
          </h3>
          <p className="mt-1 text-sm text-teal-900">
            Your clinic can use the selected plan until{" "}
            {user.hospital.trialEndsAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}. Pay from Subscription to
            keep working after that.
          </p>
          {user.role === "SUPER_ADMIN" ? (
            <Link href="/hospital/subscription" className="mt-3 inline-flex text-sm font-medium text-teal-800 hover:underline">
              Subscribe now →
            </Link>
          ) : null}
        </section>
      ) : null}

      {openHelpdeskTickets.length > 0 && (user?.role === "SOFTWARE_ADMIN" || user?.role === "HELPDESK") ? (
        <section className="mb-6 rounded-2xl border border-violet-200 bg-violet-50 p-5">
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
                  className="block rounded-xl border border-violet-100 bg-white px-4 py-3 hover:border-teal-300"
                >
                  <p className="font-medium text-slate-900">
                    {ticket.number} · {ticket.subject}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {ticket.hospital ? `${ticket.hospital.name} · ` : ""}
                    from {ticket.createdBy.username} · {ticket.status.replace(/_/g, " ").toLowerCase()}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {pendingJoins > 0 ? (
        <section className="mb-6 rounded-2xl border border-teal-200 bg-teal-50 p-5">
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
        <section className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
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

      {user && !user.hospitalId && !isPlatformRole(user.role) ? (
        <section className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
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

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(platformStats ?? hospitalStats ?? []).map((stat) => {
          const card = (
            <>
              <p className="text-sm text-slate-500">{stat.label}</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight">{stat.value}</p>
              {"yesterday" in stat && stat.yesterday ? (
                <p className="mt-1 text-[11px] leading-tight text-slate-400">{stat.yesterday}</p>
              ) : null}
            </>
          );
          const href = "href" in stat ? stat.href : undefined;
          return href ? (
            <Link
              key={stat.label}
              href={href}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-600 hover:shadow-md"
            >
              {card}
            </Link>
          ) : (
            <article key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              {card}
            </article>
          );
        })}
      </section>

      {openHelpdeskTickets.length > 0 && (user?.role === "SOFTWARE_ADMIN" || user?.role === "HELPDESK") ? (
        <section className="mt-6 sm:mt-8">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="font-semibold">Helpdesk queue</h3>
            <Link href="/helpdesk" className="text-sm font-medium text-teal-700 hover:underline">
              View all
            </Link>
          </div>
          <div className="[&>div]:rounded-2xl [&>div]:border [&>div]:border-slate-200 [&>div]:bg-white [&>div]:shadow-sm">
            <FilterableTable
              empty="No open tickets."
              rows={openHelpdeskTickets.map((ticket) => ({
                id: ticket.id,
                number: ticket.number,
                subject: ticket.subject,
                hospital: ticket.hospital?.name ?? "Platform",
                from: ticket.createdBy.username,
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

      {user?.role === "LAB_TECH" ? (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:mt-8">
          <h3 className="font-semibold">Laboratory</h3>
          <p className="mt-1 text-sm text-slate-500">
            Paid requests wait here. Upload the report and mark done. The doctor is notified on the patient record.
          </p>
          <Link href="/lab" className="mt-3 inline-flex text-sm font-medium text-teal-700 hover:underline">
            Open laboratory →
          </Link>
        </section>
      ) : null}

      {user?.hospitalId && !isPlatformRole(user.role) && user.role !== "LAB_TECH" ? (
        <section className="mt-6 space-y-6 sm:mt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
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
            </div>
            <OpdDayNav action="/" dateValue={dateValue} />
          </div>
          {doctorQueues.length === 0 ? (
            <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
              {isToday ? "No doctor queues to show yet." : `No OPD visits on ${dayLabel}.`}
            </p>
          ) : (
            doctorQueues.map((group) => (
              <div key={group.doctorId} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
                  <div>
                    <p className="font-semibold">{doctorName(group.doctor)}</p>
                    <p className="text-xs text-slate-500">
                      {isToday
                        ? `Waiting ${group.waiting} · With doctor ${group.inConsult} · Today ${group.items.length} · Next token ${tokenLabel(group.lastToken + 1)}`
                        : `Completed ${group.items.filter((row) => row.status === "COMPLETED").length} · Visits ${group.items.length}`}
                    </p>
                  </div>
                  <Link href={queueHref} className="text-sm text-teal-700 hover:underline">
                    Open OPD
                  </Link>
                </div>
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
                    empty={
                      isToday
                        ? "No patients in this doctor's queue yet. Tokens start at T-001."
                        : "No patients in this doctor's OPD on this date."
                    }
                    columns={[
                      { key: "token", header: "Token" },
                      { key: "time", header: "Time" },
                      { key: "patient", header: "Patient", className: "font-medium" },
                      { key: "department", header: "Department" },
                      { key: "status", header: "Status" },
                      { key: "vitals", header: "Vitals" },
                    ]}
                  />
                </div>
              </div>
            ))
          )}
        </section>
      ) : null}
    </AppShell>
  );
}
