import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AdmitForm } from "@/components/admit-form";
import { WardCapacityCards } from "@/components/ward-capacity-cards";
import { doctorName, listBookableDoctors } from "@/lib/front-desk";
import { prisma } from "@/lib/prisma";
import { WARD_ADMIT_ROLES, listWardCapacity, requireWardsPage, seedHospitalWards } from "@/lib/wards";

export default async function AdmitPage({
  searchParams,
}: {
  searchParams: Promise<{ patientId?: string; bedId?: string; appointmentId?: string }>;
}) {
  const user = await requireWardsPage();
  if (!WARD_ADMIT_ROLES.includes(user.role)) redirect("/wards");
  await seedHospitalWards(user.hospitalId);

  const { patientId, bedId, appointmentId } = await searchParams;

  const [doctors, departments, beds, capacity, patient, appointment] = await Promise.all([
    listBookableDoctors(user.hospitalId),
    prisma.department.findMany({ where: { hospitalId: user.hospitalId }, orderBy: { name: "asc" } }),
    prisma.bed.findMany({
      where: {
        hospitalId: user.hospitalId,
        isActive: true,
        status: "AVAILABLE",
        isOccupied: false,
        ward: { isActive: true },
      },
      orderBy: [{ ward: { name: "asc" } }, { number: "asc" }],
      include: { ward: true },
    }),
    listWardCapacity(user.hospitalId),
    patientId
      ? prisma.patient.findFirst({
          where: { id: patientId, hospitalId: user.hospitalId, mergedIntoId: null },
          select: { id: true, mrn: true, firstName: true, lastName: true, phone: true },
        })
      : Promise.resolve(null),
    appointmentId
      ? prisma.appointment.findFirst({
          where: { id: appointmentId, hospitalId: user.hospitalId },
          include: { patient: true },
        })
      : Promise.resolve(null),
  ]);

  const initialPatient = patient ?? (appointment
    ? {
        id: appointment.patient.id,
        mrn: appointment.patient.mrn,
        firstName: appointment.patient.firstName,
        lastName: appointment.patient.lastName,
        phone: appointment.patient.phone,
      }
    : null);

  return (
    <AppShell title="Admit patient">
      <p className="mb-4 text-sm text-slate-500">
        Choose a bed from the categories configured by super admin. Free / total shows how many rooms or beds
        are left in each type. Optional advance is stored on the stay and applied at discharge.
      </p>
      <WardCapacityCards rows={capacity} />
      <AdmitForm
        doctors={doctors.map((doctor) => ({ id: doctor.id, label: doctorName(doctor) }))}
        departments={departments.map((dept) => ({ id: dept.id, label: dept.name }))}
        beds={beds.map((bed) => ({
          id: bed.id,
          label: `${bed.ward.name} · ${bed.number}${bed.ward.genderPolicy !== "MIXED" ? ` (${bed.ward.genderPolicy.toLowerCase()})` : ""}`,
          group: bed.ward.name,
        }))}
        initialPatient={initialPatient}
        sourceAppointmentId={appointment?.id ?? null}
        defaultBedId={bedId}
        defaultDoctorId={appointment?.doctorId}
      />
    </AppShell>
  );
}
