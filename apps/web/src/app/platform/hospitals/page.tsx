import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { FilterableTable } from "@/components/filterable-table";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AddHospitalForm } from "./hospital-form";

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
    <AppShell title="Hospitals">
      <p className="mb-6 text-sm text-slate-500">
        Register a hospital on a fixed monthly plan (Starter, Growth, Professional, or Enterprise), collect payment, and
        generate a platform invoice. Seat mixes are flexible within each plan’s limit.
      </p>
      <AddHospitalForm />
      <div className="mt-8">
        <FilterableTable
          minWidthClass="min-w-[48rem]"
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
            status: hospital.isActive ? "Active" : "Inactive",
            openHospital: "Open",
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
            { key: "status", header: "Status" },
            { key: "openHospital", header: "Subscription", hrefKey: "hospitalHref" },
            { key: "openUsers", header: "User list", hrefKey: "usersHref" },
            { key: "openLogs", header: "Audit log", hrefKey: "logsHref" },
          ]}
        />
      </div>
    </AppShell>
  );
}
