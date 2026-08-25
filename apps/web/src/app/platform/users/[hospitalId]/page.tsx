import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { FilterableTable } from "@/components/filterable-table";
import { prisma } from "@/lib/prisma";

function formatDate(value: Date) {
  return value.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export default async function HospitalUsersForSaasPage({
  params,
}: {
  params: Promise<{ hospitalId: string }>;
}) {
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
          role: true,
          isVerified: true,
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
      <p className="mb-6 text-sm text-slate-500">
        <Link className="text-teal-700 hover:underline" href="/platform/users">
          Select hospital
        </Link>
        {" · "}
        {hospital.code}
      </p>
      <FilterableTable
        minWidthClass="min-w-[720px]"
        empty="No users in this hospital yet."
        rows={hospital.users.map((row) => ({
          id: row.id,
          username: row.username,
          mobile: row.mobile,
          role: row.role.replace(/_/g, " "),
          verified: row.isVerified ? "Yes" : "Pending OTP",
          joined: formatDate(row.createdAt),
          lastLogin: row.sessions[0] ? formatDate(row.sessions[0].createdAt) : "Never",
        }))}
        columns={[
          { key: "username", header: "Username", className: "font-medium" },
          { key: "mobile", header: "Mobile" },
          { key: "role", header: "Role" },
          { key: "verified", header: "Verified" },
          { key: "joined", header: "Joined" },
          { key: "lastLogin", header: "Last login" },
        ]}
      />
    </AppShell>
  );
}
