import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import HospitalUserForm from "@/components/hospital-user-form";
import { UserSignatureManager } from "@/components/user-signature-manager";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userFormInitial } from "@/lib/user-form-initial";

export default async function PlatformEditHospitalUserPage({
  params,
}: {
  params: Promise<{ hospitalId: string; userId: string }>;
}) {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== "SOFTWARE_ADMIN") redirect("/login");

  const { hospitalId, userId } = await params;
  const [hospital, user, departments] = await Promise.all([
    prisma.hospital.findUnique({ where: { id: hospitalId }, select: { id: true, name: true, code: true } }),
    prisma.appUser.findFirst({
      where: { id: userId, hospitalId },
      include: { staffProfile: true },
    }),
    prisma.department.findMany({
      where: { hospitalId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  if (!hospital || !user || user.role === "SOFTWARE_ADMIN" || user.role === "HELPDESK") notFound();

  return (
    <AppShell title={`Edit ${user.firstName ?? user.username}`}>
      <p className="mb-6 text-sm text-slate-500">
        <Link className="text-teal-700 hover:underline" href={`/platform/users/${hospital.id}`}>
          Back to users
        </Link>
        {" · "}
        {hospital.code} · {user.userCode ?? "User ID pending"} · {user.role.replace(/_/g, " ")}
      </p>
      <HospitalUserForm
        initial={userFormInitial(user)}
        hospitalId={hospital.id}
        allowSuperAdminRole
        returnHref={`/platform/users/${hospital.id}`}
        updateUrl={`/api/hospital/users/${user.id}`}
        departments={departments.map((row) => ({ id: row.id, label: row.name }))}
      />
      <div className="mt-6">
        <UserSignatureManager userId={user.id} roleLabel={user.role.replace(/_/g, " ")} />
      </div>
    </AppShell>
  );
}
