import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { FilterableTable } from "@/components/filterable-table";
import { primaryButtonClass } from "@/components/auth-shell";
import { ageYears, FRONT_DESK_ROLES, PATIENT_REGISTER_ROLES, patientName, prettyEnum, requireHospitalPage } from "@/lib/front-desk";
import { prisma } from "@/lib/prisma";

export default async function PatientsPage() {
  const user = await requireHospitalPage();
  if (user.role === "LAB_TECH") redirect("/lab");

  const patients = await prisma.patient.findMany({
    where: {
      hospitalId: user.hospitalId,
      mergedIntoId: null,
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <AppShell title="Patients">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">Search by name, phone, UHID, or family group</p>
        {PATIENT_REGISTER_ROLES.includes(user.role) ? (
          <Link href="/patients/new" className={primaryButtonClass}>
            Register patient
          </Link>
        ) : null}
      </div>
      <FilterableTable
        searchPlaceholder="Search name, phone, or UHID"
        rows={patients.map((row) => ({
          id: row.id,
          mrn: row.mrn,
          name: patientName(row),
          age: String(ageYears(row.dateOfBirth)),
          gender: prettyEnum(row.gender),
          phone: row.phone ?? "—",
          family: row.familyGroupCode ?? "—",
          href: `/patients/${row.id}`,
          ...(FRONT_DESK_ROLES.includes(user.role)
            ? { edit: "Edit", editHref: `/patients/${row.id}/edit` }
            : {}),
        }))}
        empty="No patients registered yet."
        columns={[
          { key: "mrn", header: "UHID / MRN", className: "font-mono text-xs", hrefKey: "href" },
          { key: "name", header: "Name", className: "font-medium", hrefKey: "href" },
          { key: "age", header: "Age" },
          { key: "gender", header: "Gender" },
          { key: "phone", header: "Phone" },
          { key: "family", header: "Family" },
          ...(FRONT_DESK_ROLES.includes(user.role)
            ? [{ key: "edit", header: "Action", filter: false as const, hrefKey: "editHref" }]
            : []),
        ]}
      />
    </AppShell>
  );
}
