import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import {
  AddBedsForm,
  WardCapacityForm,
  WardCreateForm,
  WardRatesForm,
} from "@/components/ward-setup-forms";
import { WardCapacityCards } from "@/components/ward-capacity-cards";
import { secondaryButtonClass } from "@/components/auth-shell";
import { inr, prettyEnum } from "@/lib/front-desk";
import { prisma } from "@/lib/prisma";
import { WARD_MASTER_ROLES, listWardCapacity, requireWardsPage, seedHospitalWards } from "@/lib/wards";

export default async function WardSetupPage() {
  const user = await requireWardsPage();
  if (!WARD_MASTER_ROLES.includes(user.role)) redirect("/wards");

  await seedHospitalWards(user.hospitalId);

  const [departments, wards, capacity] = await Promise.all([
    prisma.department.findMany({ where: { hospitalId: user.hospitalId }, orderBy: { name: "asc" } }),
    prisma.ward.findMany({
      where: { hospitalId: user.hospitalId },
      orderBy: { name: "asc" },
      include: { department: true, _count: { select: { beds: true } } },
    }),
    listWardCapacity(user.hospitalId),
  ]);

  return (
    <AppShell title="Ward setup">
      <div className="mb-4">
        <Link href="/wards" className={secondaryButtonClass}>
          Occupancy board
        </Link>
      </div>
      <p className="mb-6 max-w-3xl text-sm text-slate-500">
        Set how many rooms and beds the hospital has for each category. Receptionists see free vs total when
        admitting. You can still adjust rates and add extra beds per ward below.
      </p>

      <WardCapacityForm
        fields={capacity.map((row) => ({
          code: row.code,
          label: row.capacityLabel,
          total: row.total,
        }))}
      />
      <WardCapacityCards rows={capacity} title="Current occupancy by category" />

      <WardCreateForm departments={departments.map((row) => ({ id: row.id, label: row.name }))} />

      <div className="mt-8 space-y-4">
        {wards.map((ward) => (
          <section key={ward.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <h3 className="font-semibold">{ward.name}</h3>
            <p className="text-sm text-slate-500">
              {ward.code} · {prettyEnum(ward.type)} · {prettyEnum(ward.genderPolicy)} · {ward.department.name} ·{" "}
              {ward._count.beds} bed{ward._count.beds === 1 ? "" : "s"} · {inr(ward.dailyRate)} / {inr(ward.nursingRate)}
              {!ward.isActive ? " · inactive" : ""}
            </p>
            <WardRatesForm
              wardId={ward.id}
              dailyRate={Number(ward.dailyRate)}
              nursingRate={Number(ward.nursingRate)}
              isActive={ward.isActive}
            />
            <AddBedsForm wardId={ward.id} prefix={ward.code} />
          </section>
        ))}
      </div>
    </AppShell>
  );
}
