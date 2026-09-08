import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { FilterableTable } from "@/components/filterable-table";
import { primaryButtonClass } from "@/components/auth-shell";
import {
  DOCTOR_VISIT_ROLES,
  PRINT_SUMMARY_ROLES,
  patientName,
  prettyEnum,
  requireHospitalPage,
} from "@/lib/front-desk";
import { certificateTitle, formatCertDate } from "@/lib/medical-certificates";
import { prisma } from "@/lib/prisma";

export default async function CertificatesPage() {
  const user = await requireHospitalPage();
  if (!PRINT_SUMMARY_ROLES.includes(user.role)) redirect("/");

  const canIssue = DOCTOR_VISIT_ROLES.includes(user.role);
  const certificates = await prisma.medicalCertificate.findMany({
    where: { hospitalId: user.hospitalId },
    include: { patient: { select: { firstName: true, lastName: true, mrn: true } } },
    orderBy: { issuedAt: "desc" },
    take: 200,
  });

  return (
    <AppShell title="Medical certificates">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">
          Issued certificates for any registered patient. Doctors can issue; reception can print.
        </p>
        {canIssue ? (
          <Link href="/certificates/new" className={primaryButtonClass}>
            Issue certificate
          </Link>
        ) : null}
      </div>
      <FilterableTable
        searchPlaceholder="Search patient, UHID, or certificate no."
        empty="No medical certificates issued yet."
        rows={certificates.map((row) => ({
          id: row.id,
          certificateNo: row.certificateNo,
          patient: patientName(row.patient),
          mrn: row.patient.mrn,
          type: certificateTitle(row.type),
          issued: formatCertDate(row.issuedAt),
          doctor: row.issuedByDisplayName || row.issuedByUsername,
          status: prettyEnum(row.status),
          href: `/certificates/${row.id}`,
        }))}
        columns={[
          { key: "certificateNo", header: "No.", className: "font-mono text-xs", hrefKey: "href" },
          { key: "patient", header: "Patient", className: "font-medium", hrefKey: "href" },
          { key: "mrn", header: "UHID", className: "font-mono text-xs" },
          { key: "type", header: "Type" },
          { key: "issued", header: "Issued" },
          { key: "doctor", header: "Doctor" },
          { key: "status", header: "Status" },
        ]}
      />
    </AppShell>
  );
}
