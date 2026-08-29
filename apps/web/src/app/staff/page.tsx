import { AppShell } from "@/components/app-shell";
import { FilterableTable } from "@/components/filterable-table";
import { requireHospitalPage } from "@/lib/front-desk";
import { prisma } from "@/lib/prisma";

function prettyRole(role: string) {
  return role.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function staffDisplayName(row: {
  role: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
  staffProfile: { firstName: string; lastName: string } | null;
}) {
  const fromProfile = row.staffProfile
    ? `${row.staffProfile.firstName} ${row.staffProfile.lastName}`.trim()
    : "";
  const fromUser = `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim();
  const name = fromUser || fromProfile || row.username.replace(/[._]/g, " ");
  const titled = name.replace(/\b\w/g, (letter) => letter.toUpperCase());
  if (row.role === "DOCTOR" && !/^dr\b/i.test(titled)) return `Dr. ${titled}`;
  return titled;
}

export default async function StaffPage() {
  const user = await requireHospitalPage();

  const people = await prisma.appUser.findMany({
    where: { hospitalId: user.hospitalId, isActive: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { username: "asc" }],
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      mobile: true,
      email: true,
      role: true,
      employeeId: true,
      staffProfile: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          designation: true,
          jobTitle: true,
          department: { select: { name: true } },
        },
      },
    },
  });

  return (
    <AppShell title="Staff">
      <p className="mb-6 text-sm text-slate-500">
        People who work at {user.hospital?.name ?? "this hospital"}. Super admin adds or edits them under Hospital
        users.
      </p>
      <FilterableTable
        empty="No staff in this hospital yet."
        searchPlaceholder="Search name, role, or department"
        rows={people.map((row) => ({
          id: row.id,
          name: staffDisplayName(row),
          role: prettyRole(row.role),
          dept: row.staffProfile?.department?.name ?? row.staffProfile?.jobTitle ?? row.staffProfile?.designation ?? "—",
          mobile: row.mobile || row.staffProfile?.phone || "—",
          email: row.email || row.staffProfile?.email || "—",
          employeeId: row.employeeId ?? "—",
        }))}
        columns={[
          { key: "name", header: "Name", className: "font-medium" },
          { key: "role", header: "Role" },
          { key: "dept", header: "Department" },
          { key: "mobile", header: "Mobile" },
          { key: "email", header: "Email" },
          { key: "employeeId", header: "Employee ID" },
        ]}
      />
    </AppShell>
  );
}
