import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { primaryButtonClass, secondaryButtonClass } from "@/components/auth-shell";
import {
  NURSE_VITALS_ROLES,
  dayRange,
  doctorName,
  patientName,
  prettyEnum,
  requireHospitalPage,
  tokenLabel,
} from "@/lib/front-desk";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function NurseStationPage() {
  const user = await requireHospitalPage();
  if (!NURSE_VITALS_ROLES.includes(user.role)) redirect("/");

  const { start, end } = dayRange(new Date());
  const visits = await prisma.appointment.findMany({
    where: {
      hospitalId: user.hospitalId,
      scheduledAt: { gte: start, lt: end },
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
    },
    orderBy: [{ tokenNumber: "asc" }, { scheduledAt: "asc" }],
    include: {
      patient: true,
      doctor: { include: { appUser: { select: { username: true } } } },
      department: true,
      vitals: { select: { id: true, recordedAt: true } },
    },
  });

  const pending = visits.filter((row) => !row.vitals);
  const arrivedPending = pending.filter((row) => row.status === "CHECKED_IN" || row.status === "IN_PROGRESS" || row.queueType === "WALK_IN");
  const done = visits.filter((row) => row.vitals);

  return (
    <AppShell title="Nurse station">
      <p className="mb-4 text-sm text-slate-500">
        When reception books a consult or adds a walk-in, you are notified here. Height, weight, and temperature are required; other vitals are optional. The doctor will see them in the room.
      </p>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Vitals pending" value={String(pending.length)} />
        <Stat label="Arrived, waiting on vitals" value={String(arrivedPending.length)} />
        <Stat label="Vitals recorded today" value={String(done.length)} />
      </div>

      <h3 className="mb-3 font-semibold">Needs vitals</h3>
      <div className="space-y-3">
        {pending.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            No pending vitals. New bookings and walk-ins will appear here and in your notifications.
          </p>
        ) : (
          pending.map((row) => (
            <article key={row.id} className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold">{tokenLabel(row.tokenNumber)}</p>
                  <p className="font-medium">{patientName(row.patient)}</p>
                  <p className="text-sm text-slate-600">
                    {doctorName(row.doctor)} · {row.department.name} · {prettyEnum(row.queueType)} · {prettyEnum(row.status)}
                  </p>
                </div>
                <Link href={`/appointments/${row.id}`} className={primaryButtonClass}>
                  Record vitals
                </Link>
              </div>
            </article>
          ))
        )}
      </div>

      <h3 className="mb-3 mt-8 font-semibold">Recorded today</h3>
      <div className="space-y-3">
        {done.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">No vitals saved yet today.</p>
        ) : (
          done.map((row) => (
            <article key={row.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {tokenLabel(row.tokenNumber)} · {patientName(row.patient)}
                  </p>
                  <p className="text-sm text-slate-500">{doctorName(row.doctor)} · ready for doctor</p>
                </div>
                <Link href={`/appointments/${row.id}`} className={secondaryButtonClass}>
                  View vitals
                </Link>
              </div>
            </article>
          ))
        )}
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
    </article>
  );
}
