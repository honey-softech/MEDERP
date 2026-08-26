import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { FilterableTable } from "@/components/filterable-table";
import { secondaryButtonClass } from "@/components/auth-shell";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function formatDate(value: Date) {
  return value.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export default async function HospitalUsersForSaasPage({
  params,
}: {
  params: Promise<{ hospitalId: string }>;
}) {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== "SOFTWARE_ADMIN") redirect("/login");

  const { hospitalId } = await params;
  const hospital = await prisma.hospital.findUnique({
    where: { id: hospitalId },
    include: {
      users: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          username: true,
          mobile: true,
          email: true,
          role: true,
          isVerified: true,
          isActive: true,
          createdAt: true,
          sessions: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { createdAt: true },
          },
        },
      },
    },
  });

  if (!hospital) notFound();

  return (
    <AppShell title={`${hospital.name} users`}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          <Link className="text-teal-700 hover:underline" href="/platform/users">
            All hospitals
          </Link>
          {" · "}
          <Link className="text-teal-700 hover:underline" href={`/platform/hospitals/${hospital.id}`}>
            Hospital details
          </Link>
          {" · "}
          {hospital.code}
          {!hospital.isActive ? " · Access stopped" : ""}
        </p>
        <Link href={`/platform/users/${hospital.id}/new`} className={secondaryButtonClass}>
          Add user
        </Link>
      </div>
      <FilterableTable
        minWidthClass="min-w-[820px]"
        empty="No users in this hospital yet."
        rows={hospital.users.map((row) => ({
          id: row.id,
          username: row.username,
          mobile: row.mobile,
          email: row.email ?? "—",
          role: row.role.replace(/_/g, " "),
          access: row.isActive ? "Active" : "Disabled",
          verified: row.isVerified ? "Yes" : "Pending OTP",
          joined: formatDate(row.createdAt),
          lastLogin: row.sessions[0] ? formatDate(row.sessions[0].createdAt) : "Never",
          edit: "Edit",
          editHref: `/platform/users/${hospital.id}/${row.id}`,
        }))}
        columns={[
          { key: "username", header: "Username", className: "font-medium" },
          { key: "mobile", header: "Mobile" },
          { key: "email", header: "Email" },
          { key: "role", header: "Role" },
          { key: "access", header: "Access" },
          { key: "verified", header: "Verified" },
          { key: "joined", header: "Joined" },
          { key: "lastLogin", header: "Last login" },
          { key: "edit", header: "", hrefKey: "editHref" },
        ]}
      />
    </AppShell>
  );
}
