import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PatientForm } from "@/components/patient-form";
import { getCurrentUser } from "@/lib/auth";
import { FRONT_DESK_ROLES, patientName } from "@/lib/front-desk";
import { prisma } from "@/lib/prisma";

function dateInput(value: Date | null | undefined) {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

export default async function EditPatientPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user?.hospitalId) redirect("/login");
  if (!FRONT_DESK_ROLES.includes(user.role)) redirect("/patients");

  const { id } = await params;
  const patient = await prisma.patient.findFirst({
    where: { id, hospitalId: user.hospitalId, mergedIntoId: null },
  });
  if (!patient) notFound();

  return (
    <AppShell title={`Edit ${patientName(patient)}`}>
      <p className="mb-4 text-sm text-slate-500">
        <Link className="text-teal-700 hover:underline" href={`/patients/${patient.id}`}>
          Back to patient
        </Link>
        {" · "}
        <span className="font-mono">{patient.mrn}</span>
        {patient.familyGroupCode ? ` · ${patient.familyGroupCode}` : ""}
      </p>
      <PatientForm
        submitLabel="Save patient details"
        initial={{
          id: patient.id,
          firstName: patient.firstName,
          lastName: patient.lastName,
          dateOfBirth: dateInput(patient.dateOfBirth),
          gender: patient.gender,
          phone: patient.phone ?? "",
          email: patient.email ?? "",
          address: patient.address ?? "",
          bloodGroup: patient.bloodGroup ?? "",
          emergencyName: patient.emergencyName ?? "",
          emergencyPhone: patient.emergencyPhone ?? "",
          idProofType: patient.idProofType ?? "",
          idProofNumber: patient.idProofNumber ?? "",
          insuranceProvider: patient.insuranceProvider ?? "",
          insurancePolicyNo: patient.insurancePolicyNo ?? "",
          insuranceValidUntil: dateInput(patient.insuranceValidUntil),
          photoData: patient.photoData ?? "",
        }}
      />
    </AppShell>
  );
}
