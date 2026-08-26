import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { FilterableTable } from "@/components/filterable-table";
import { secondaryButtonClass } from "@/components/auth-shell";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function HospitalsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "SOFTWARE_ADMIN") {
    redirect("/login");
  }

  const hospitals = await prisma.hospital.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { users: true } },
      users: { where: { role: "SUPER_ADMIN" }, select: { username: true, mobile: true } },
    },
  });

  return (
    <AppShell title="Hospital list">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Manage every hospital: open details, stop access, edit users, and change subscriptions.
        </p>
        <Link href="/platform/hospitals/new" className={secondaryButtonClass}>
          Create hospital
        </Link>
      </div>
      <FilterableTable
        minWidthClass="min-w-[52rem]"
        empty="No hospitals yet."
        rows={hospitals.map((hospital) => ({
          id: hospital.id,
          name: hospital.name,
          code: hospital.code,
          address: hospital.address ?? "—",
          superAdmin: hospital.users[0]
            ? `${hospital.users[0].username} · ${hospital.users[0].mobile}`
            : "—",
          plan: hospital.subscriptionTier
            ? `${hospital.subscriptionTier}${hospital.unlimitedStaffSeats ? " · ∞ seats" : ` · ${hospital.includedStaffSlots} seats`}${hospital.pharmacyEnabled ? " · Rx" : ""}${hospital.labEnabled ? " · Lab" : ""}${hospital.inventoryEnabled ? " · Inv" : ""}`
            : "—",
          users: String(hospital._count.users),
          status: hospital.isActive ? "Active" : "Stopped",
          openHospital: "Manage",
          hospitalHref: `/platform/hospitals/${hospital.id}`,
          openUsers: "Users",
          usersHref: `/platform/users/${hospital.id}`,
          openLogs: "Logs",
          logsHref: `/platform/audit-log/${hospital.id}`,
        }))}
        columns={[
          { key: "name", header: "Hospital", className: "font-medium" },
          { key: "code", header: "Code", className: "font-mono text-xs" },
          { key: "address", header: "Address", className: "text-slate-600" },
          { key: "superAdmin", header: "Super admin" },
          { key: "plan", header: "Plan" },
          { key: "users", header: "Users" },
          { key: "status", header: "Access" },
          { key: "openHospital", header: "Details", hrefKey: "hospitalHref" },
          { key: "openUsers", header: "Users", hrefKey: "usersHref" },
          { key: "openLogs", header: "Audit log", hrefKey: "logsHref" },
        ]}
      />
    </AppShell>
  );
}
