import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { FilterableTable } from "@/components/filterable-table";
import { getCurrentUser } from "@/lib/auth";
import { countHospitalStaffSeats } from "@/lib/platform-billing";
import { staffSeatLimit } from "@/lib/platform-pricing";
import { prisma } from "@/lib/prisma";
import { CreateUserDialog } from "@/components/create-user-dialog";

export default async function HospitalUsersPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "SUPER_ADMIN" || !user.hospitalId) {
    redirect("/login");
  }

  const [users, departments, usedSeats, hospital] = await Promise.all([
    prisma.appUser.findMany({
      where: { hospitalId: user.hospitalId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        userCode: true,
        employeeId: true,
        username: true,
        firstName: true,
        lastName: true,
        mobile: true,
        role: true,
        isVerified: true,
        isActive: true,
      },
    }),
    prisma.department.findMany({
      where: { hospitalId: user.hospitalId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    countHospitalStaffSeats(user.hospitalId),
    prisma.hospital.findUnique({
      where: { id: user.hospitalId },
      select: {
        includedStaffSlots: true,
        extraStaffSlots: true,
        unlimitedStaffSeats: true,
        subscriptionTier: true,
      },
    }),
  ]);

  const seatLimit = hospital ? staffSeatLimit(hospital) : 0;
  const seatLimitReached = seatLimit != null && usedSeats >= seatLimit;
  const remainingSeats = seatLimit == null ? null : Math.max(0, seatLimit - usedSeats);
  const seatMessage =
    seatLimit == null
      ? `Unlimited staff seats on Enterprise. ${usedSeats} in use.`
      : `You can add ${seatLimit} staff user${seatLimit === 1 ? "" : "s"}. ${usedSeats} in use, ${remainingSeats} remaining.`;
  const limitReason = `Maximum user limit reached (${usedSeats}/${seatLimit}). Upgrade your subscription plan to continue.`;

  return (
    <AppShell title="Hospital users">
      <p className="mb-6 text-sm text-slate-500">
        Add or edit users for {user.hospital?.name} ({user.hospital?.code}). Staff can sign up themselves,
        then you approve them under Join requests — they cannot add themselves to this hospital.
      </p>
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold">Staff subscription usage</h3>
            <p className="mt-1 text-sm text-slate-600">{seatMessage}</p>
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
            {usedSeats}/{seatLimit == null ? "∞" : seatLimit} used
          </div>
        </div>
        {seatLimitReached ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {limitReason}
          </p>
        ) : null}
      </div>
      <CreateUserDialog
        departments={departments.map((row) => ({ id: row.id, label: row.name }))}
        disabled={seatLimitReached}
        disabledReason={limitReason}
        subscriptionHref="/hospital/subscription"
      />
      <div className="mt-8">
        <FilterableTable
          rows={users.map((row) => ({
            id: row.id,
            code: row.userCode ?? "—",
            employeeId: row.employeeId ?? "—",
            username: row.firstName ? `${row.firstName} ${row.lastName ?? ""}`.trim() : row.username,
            mobile: row.mobile,
            role: row.role.replace(/_/g, " "),
            verified: row.isActive === false ? "Inactive" : row.isVerified ? "Active" : "Pending OTP",
            edit: "Edit",
            href: `/hospital/users/${row.id}`,
          }))}
          columns={[
            { key: "code", header: "User ID", className: "font-mono text-xs" },
            { key: "employeeId", header: "Employee ID" },
            { key: "username", header: "Name", className: "font-medium", hrefKey: "href" },
            { key: "mobile", header: "Mobile" },
            { key: "role", header: "Role" },
            { key: "verified", header: "Status" },
            { key: "edit", header: "Action", filter: false, hrefKey: "href" },
          ]}
        />
      </div>
    </AppShell>
  );
}
