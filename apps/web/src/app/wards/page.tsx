import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { BedStatusButton } from "@/components/bed-status-button";
import { primaryButtonClass, secondaryButtonClass } from "@/components/auth-shell";
import {
  ageYears,
  inr,
  patientName,
  prettyEnum,
} from "@/lib/front-desk";
import { prisma } from "@/lib/prisma";
import { bedStatusClass, statusBadgeBase } from "@/lib/ui";
import { WardCapacityCards } from "@/components/ward-capacity-cards";
import {
  ACTIVE_ADMISSION_STATUSES,
  WARD_ADMIT_ROLES,
  WARD_HOUSEKEEPING_ROLES,
  WARD_MASTER_ROLES,
  WARD_VIEW_ROLES,
  listWardCapacity,
  requireWardsPage,
  seedHospitalWards,
  stayDays,
} from "@/lib/wards";

export default async function WardsPage() {
  const user = await requireWardsPage();
  if (!WARD_VIEW_ROLES.includes(user.role)) redirect("/");

  await seedHospitalWards(user.hospitalId);

  const [wards, capacity] = await Promise.all([
    prisma.ward.findMany({
      where: { hospitalId: user.hospitalId },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      include: {
        department: true,
        beds: {
          where: { isActive: true },
          orderBy: { number: "asc" },
          include: {
            admissions: {
              where: { status: { in: [...ACTIVE_ADMISSION_STATUSES] } },
              include: { patient: true },
              take: 1,
            },
          },
        },
      },
    }),
    listWardCapacity(user.hospitalId),
  ]);

  const beds = wards.flatMap((ward) => ward.beds);
  const occupied = beds.filter((bed) => bed.status === "OCCUPIED").length;
  const available = beds.filter((bed) => bed.status === "AVAILABLE" && bed.isActive).length;
  const housekeeping = beds.filter((bed) => bed.status === "HOUSEKEEPING").length;
  const inHouse = beds.reduce((sum, bed) => sum + bed.admissions.length, 0);

  const canAdmit = WARD_ADMIT_ROLES.includes(user.role);
  const canHousekeep = WARD_HOUSEKEEPING_ROLES.includes(user.role);
  const canSetup = WARD_MASTER_ROLES.includes(user.role);

  return (
    <AppShell title="Wards & beds">
      <div className="mb-4 flex flex-wrap gap-2">
        {canAdmit ? (
          <Link href="/wards/admit" className={primaryButtonClass}>
            Admit patient
          </Link>
        ) : null}
        {canSetup ? (
          <Link href="/wards/setup" className={secondaryButtonClass}>
            Ward setup
          </Link>
        ) : null}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Beds" value={String(beds.length)} />
        <Stat label="Occupied" value={String(occupied)} />
        <Stat label="Available" value={String(available)} />
        <Stat label="Housekeeping" value={String(housekeeping)} />
      </div>
      <WardCapacityCards rows={capacity} />
      <p className="mb-6 text-sm text-slate-500">{inHouse} inpatient{inHouse === 1 ? "" : "s"} currently in house.</p>

      {wards.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          No wards yet. Super admin can create them under Ward setup.
        </p>
      ) : (
        <div className="space-y-6">
          {wards.map((ward) => {
            const wardOccupied = ward.beds.filter((bed) => bed.status === "OCCUPIED").length;
            return (
              <section key={ward.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{ward.name}</h2>
                    <p className="text-sm text-slate-500">
                      {ward.code} · {prettyEnum(ward.type)} · {prettyEnum(ward.genderPolicy)}
                      {ward.floor ? ` · ${ward.floor}` : ""} · {ward.department.name} · {inr(ward.dailyRate)}/day
                      {!ward.isActive ? " · inactive" : ""}
                    </p>
                  </div>
                  <span className={`${statusBadgeBase} ${bedStatusClass(wardOccupied ? "OCCUPIED" : "AVAILABLE")}`}>
                    {wardOccupied}/{ward.beds.length} occupied
                  </span>
                </div>
                {ward.beds.length === 0 ? (
                  <p className="text-sm text-slate-500">No beds in this ward yet.</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {ward.beds.map((bed) => {
                      const stay = bed.admissions[0];
                      return (
                        <article key={bed.id} className="rounded-xl border border-slate-200 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium">{bed.number}</p>
                            <span className={`${statusBadgeBase} ${bedStatusClass(bed.status)}`}>
                              {prettyEnum(bed.status)}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500">
                            {prettyEnum(bed.type)}
                            {bed.room ? ` · Room ${bed.room}` : ""}
                          </p>
                          {stay ? (
                            <div className="mt-2">
                              <Link className="font-medium text-teal-700 hover:underline" href={`/wards/stays/${stay.id}`}>
                                {patientName(stay.patient)}
                              </Link>
                              <p className="font-mono text-xs text-slate-500">{stay.patient.mrn}</p>
                              <p className="text-xs text-slate-500">
                                {ageYears(stay.patient.dateOfBirth)} yrs · day {stayDays(stay.admittedAt)}
                              </p>
                            </div>
                          ) : canAdmit && bed.status === "AVAILABLE" ? (
                            <Link href={`/wards/admit?bedId=${bed.id}`} className={`${secondaryButtonClass} mt-3`}>
                              Admit here
                            </Link>
                          ) : (
                            <p className="mt-2 text-xs text-slate-400">Empty</p>
                          )}
                          {canHousekeep && bed.status === "HOUSEKEEPING" ? (
                            <div className="mt-3">
                              <BedStatusButton bedId={bed.id} action="ready" label="Mark cleaned" />
                            </div>
                          ) : null}
                          {canHousekeep && (bed.status === "MAINTENANCE" || bed.status === "BLOCKED") ? (
                            <div className="mt-3">
                              <BedStatusButton bedId={bed.id} action="ready" label="Make available" />
                            </div>
                          ) : null}
                          {canHousekeep && bed.status === "AVAILABLE" ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              <BedStatusButton bedId={bed.id} action="maintenance" label="Maintenance" />
                              <BedStatusButton bedId={bed.id} action="block" label="Block" />
                            </div>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
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
