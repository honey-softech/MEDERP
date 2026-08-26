import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import HospitalUserForm from "@/components/hospital-user-form";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function PlatformCreateHospitalUserPage({
  params,
}: {
  params: Promise<{ hospitalId: string }>;
}) {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== "SOFTWARE_ADMIN") redirect("/login");

  const { hospitalId } = await params;
  const [hospital, departments] = await Promise.all([
    prisma.hospital.findUnique({ where: { id: hospitalId }, select: { id: true, name: true, code: true } }),
    prisma.department.findMany({
      where: { hospitalId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  if (!hospital) notFound();

  return (
    <AppShell title={`Add user · ${hospital.name}`}>
      <p className="mb-6 text-sm text-slate-500">
        <Link className="text-teal-700 hover:underline" href={`/platform/users/${hospital.id}`}>
          Back to users
        </Link>
        {" · "}
        {hospital.code}
      </p>
      <HospitalUserForm
        hospitalId={hospital.id}
        allowSuperAdminRole
        returnHref={`/platform/users/${hospital.id}`}
        createUrl="/api/hospital/users"
        departments={departments.map((row) => ({ id: row.id, label: row.name }))}
      />
    </AppShell>
  );
}
