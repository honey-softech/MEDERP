import { AppShell } from "@/components/app-shell";
import { AppointmentForm } from "@/components/appointment-form";
import { doctorName, FRONT_DESK_ROLES, listBookableDoctors, requireHospitalPage } from "@/lib/front-desk";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function NewAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{ walkin?: string; patientId?: string }>;
}) {
  const user = await requireHospitalPage();
  if (!FRONT_DESK_ROLES.includes(user.role)) redirect("/appointments");
  const { walkin, patientId } = await searchParams;
  const [doctors, departments, patient] = await Promise.all([
    listBookableDoctors(user.hospitalId),
    prisma.department.findMany({
      where: { hospitalId: user.hospitalId },
      orderBy: { name: "asc" },
    }),
    patientId
      ? prisma.patient.findFirst({
          where: { id: patientId, hospitalId: user.hospitalId, mergedIntoId: null },
          select: { id: true, mrn: true, firstName: true, lastName: true, phone: true },
        })
      : Promise.resolve(null),
  ]);

  return (
    <AppShell title={walkin ? "Walk-in registration" : "Book appointment"}>
      <p className="mb-4 text-sm text-slate-500">
        Search an existing patient to book. For a new patient, register them first, then schedule. Walk-ins join the OPD queue immediately.
      </p>
      <AppointmentForm
        defaultQueueType={walkin ? "WALK_IN" : "SCHEDULED"}
        initialPatient={patient}
        doctors={doctors.map((doctor) => ({ id: doctor.id, label: doctorName(doctor) }))}
        departments={departments.map((dept) => ({ id: dept.id, label: dept.name }))}
      />
    </AppShell>
  );
}
