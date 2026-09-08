import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { MedicalCertificateForm } from "@/components/medical-certificate-form";
import { DOCTOR_VISIT_ROLES, requireHospitalPage } from "@/lib/front-desk";
import { prisma } from "@/lib/prisma";

export default async function NewCertificatePage({
  searchParams,
}: {
  searchParams: Promise<{ patientId?: string; appointmentId?: string }>;
}) {
  const user = await requireHospitalPage();
  if (!DOCTOR_VISIT_ROLES.includes(user.role)) redirect("/");

  const { patientId, appointmentId } = await searchParams;
  const patient = patientId
    ? await prisma.patient.findFirst({
        where: { id: patientId, hospitalId: user.hospitalId, mergedIntoId: null },
        select: { id: true, mrn: true, firstName: true, lastName: true, phone: true },
      })
    : null;
  if (patientId && !patient) notFound();

  let linkedAppointmentId: string | null = null;
  if (appointmentId && patient) {
    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, hospitalId: user.hospitalId, patientId: patient.id },
      select: { id: true },
    });
    linkedAppointmentId = appointment?.id ?? null;
  }

  return (
    <AppShell title="Issue medical certificate">
      <p className="mb-4 max-w-3xl text-sm text-slate-500">
        Issue a sick-leave, fitness, or general certificate for any patient registered at this hospital. An
        appointment is optional.
      </p>
      <MedicalCertificateForm initialPatient={patient} appointmentId={linkedAppointmentId} />
    </AppShell>
  );
}
