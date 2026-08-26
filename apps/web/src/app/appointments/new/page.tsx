import { AppShell } from "@/components/app-shell";
import { AppointmentForm } from "@/components/appointment-form";
import {
  doctorName,
  ensureDoctorStaff,
  FRONT_DESK_ROLES,
  listBookableDoctors,
  requireHospitalPage,
  staffIdForAppUser,
  WALK_IN_ROLES,
} from "@/lib/front-desk";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function NewAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{ walkin?: string; patientId?: string }>;
}) {
  const user = await requireHospitalPage();
  const canFrontDesk = FRONT_DESK_ROLES.includes(user.role);
  const canWalkIn = WALK_IN_ROLES.includes(user.role);
  if (!canWalkIn) redirect("/appointments");

  const { walkin, patientId } = await searchParams;
  const doctorWalkIn = user.role === "DOCTOR";
  if (doctorWalkIn && !walkin) {
    redirect(patientId ? `/appointments/new?walkin=1&patientId=${patientId}` : "/appointments/new?walkin=1");
  }

  if (doctorWalkIn) {
    await ensureDoctorStaff({
      hospitalId: user.hospitalId,
      appUserId: user.id,
      username: user.username,
      mobile: user.mobile,
    });
  }
  const myStaffId = doctorWalkIn ? await staffIdForAppUser(user.id, user.hospitalId) : null;
  const [doctors, departments, patient, myStaff] = await Promise.all([
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
    myStaffId
      ? prisma.staff.findFirst({
          where: { id: myStaffId, hospitalId: user.hospitalId },
          select: { id: true, departmentId: true },
        })
      : Promise.resolve(null),
  ]);

  const doctorOptions = doctors.map((doctor) => ({ id: doctor.id, label: doctorName(doctor) }));

  return (
    <AppShell title={walkin || doctorWalkIn ? "Walk-in registration" : "Book appointment"}>
      <p className="mb-4 text-sm text-slate-500">
        {doctorWalkIn
          ? "Add a walk-in to your OPD queue. Register a new patient first if they are not already in the hospital."
          : "Search an existing patient to book. For a new patient, register them first, then schedule. Walk-ins join the OPD queue immediately."}
      </p>
      {doctorWalkIn && !myStaffId ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Your doctor profile is not linked. Ask the hospital admin to assign the Doctor role to your user.
        </p>
      ) : (
        <AppointmentForm
          defaultQueueType={walkin || doctorWalkIn ? "WALK_IN" : "SCHEDULED"}
          initialPatient={patient}
          doctors={doctorOptions}
          departments={departments.map((dept) => ({ id: dept.id, label: dept.name }))}
          defaultDoctorId={myStaff?.id}
          lockDoctor={Boolean(doctorWalkIn && myStaff?.id)}
          defaultDepartmentId={myStaff?.departmentId ?? undefined}
          redirectToVisit={doctorWalkIn || !canFrontDesk}
        />
      )}
    </AppShell>
  );
}
