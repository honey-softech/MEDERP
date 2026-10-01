import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { FilterableTable } from "@/components/filterable-table";
import { PlatformRemoveUserButton } from "@/components/platform-remove-user-button";
import { getCurrentUser } from "@/lib/auth";
import { isRemovedAccountMobile } from "@/lib/platform-user-remove";
import { prisma } from "@/lib/prisma";

function formatDate(value: Date) {
  return value.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export default async function UnassignedUsersPage() {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== "SOFTWARE_ADMIN") redirect("/login");

  const rows = await prisma.appUser.findMany({
    where: {
      hospitalId: null,
      role: { notIn: ["SOFTWARE_ADMIN", "HELPDESK"] },
    },
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
      joinRequests: {
        where: { status: "PENDING" },
        take: 1,
        select: { id: true, hospital: { select: { name: true, code: true } } },
      },
      sessions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
    },
  });

  const users = rows.filter((row) => !isRemovedAccountMobile(row.mobile));

  return (
    <AppShell title="Unassigned accounts">
      <p className="mb-6 text-sm text-slate-500">
        <Link className="text-teal-700 hover:underline" href="/platform/users">
          All hospitals
        </Link>
        {" · "}
        Registered users who are not linked to a hospital yet (pending OTP or waiting to join).
        You can remove an account so the mobile number can sign up again.
      </p>
      <FilterableTable
        minWidthClass="min-w-[900px]"
        empty="No unassigned accounts right now."
        rows={users.map((row) => {
          const pendingJoin = row.joinRequests[0];
          return {
            id: row.id,
            username: row.username,
            mobile: row.mobile,
            email: row.email ?? "—",
            role: row.role.replace(/_/g, " "),
            status: !row.isVerified
              ? "Pending OTP"
              : row.isActive === false
                ? "Disabled"
                : pendingJoin
                  ? `Join pending · ${pendingJoin.hospital.name}`
                  : "Verified · no hospital",
            joined: formatDate(row.createdAt),
            lastLogin: row.sessions[0] ? formatDate(row.sessions[0].createdAt) : "Never",
            remove: row.username,
          };
        })}
        columns={[
          { key: "username", header: "Username", className: "font-medium" },
          { key: "mobile", header: "Mobile" },
          { key: "email", header: "Email" },
          { key: "role", header: "Role" },
          { key: "status", header: "Status" },
          { key: "joined", header: "Signed up" },
          { key: "lastLogin", header: "Last login" },
          {
            key: "remove",
            header: "",
            filter: false,
            render: (row) => (
              <PlatformRemoveUserButton userId={row.id} label={`${row.username} / ${row.mobile}`} />
            ),
          },
        ]}
      />
    </AppShell>
  );
}
