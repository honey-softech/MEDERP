import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import HospitalUserForm from "@/components/hospital-user-form";
import { userFormInitial } from "@/lib/user-form-initial";

export default async function EditHospitalUserPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentUser();
  if (!actor?.hospitalId) notFound();
  const { id } = await params;

  const [user, departments] = await Promise.all([
    prisma.appUser.findFirst({
      where: { id, hospitalId: actor.hospitalId },
      include: { staffProfile: true },
    }),
    prisma.department.findMany({
      where: { hospitalId: actor.hospitalId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  if (!user || user.role === "SOFTWARE_ADMIN" || user.role === "HELPDESK") notFound();

  return (
    <AppShell title={`Edit ${user.firstName ?? user.username}`}>
      <p className="mb-6 text-sm text-slate-500">
        <Link className="text-teal-700 hover:underline" href="/hospital/users">
          Hospital users
        </Link>
        {" · "}
        {user.userCode ?? "User ID pending"} · {user.role.replace(/_/g, " ")}
      </p>
      <HospitalUserForm
        initial={userFormInitial(user)}
        departments={departments.map((row) => ({ id: row.id, label: row.name }))}
      />
    </AppShell>
  );
}
