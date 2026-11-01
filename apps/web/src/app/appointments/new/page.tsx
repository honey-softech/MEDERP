import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { AppointmentForm } from "@/components/appointment-form";
import {
  doctorName,
  ensureDoctorStaff,
  hasFrontDeskAccess,
  listBookableDoctors,
  requireHospitalPage,
  staffIdForAppUser,
  canAddWalkIn,
} from "@/lib/front-desk";
import { resolveViewContext } from "@/lib/view-mode";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function NewAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{ walkin?: string; patientId?: string }>;
}) {
  const user = await requireHospitalPage();
  const view = await resolveViewContext(user);
  const canWalkIn = canAddWalkIn(user);
  if (!canWalkIn) redirect("/appointments");

  const { walkin, patientId } = await searchParams;
  const canSchedule = hasFrontDeskAccess(user);
  const actingAsDoctor = user.role === "DOCTOR" || (view.canActAsDoctor && view.mode === "doctor");
  // Front desk can book a future visit, including an admin who is currently in Doctor view.
  // Doctors and nurses without that access only add today's walk-ins.
  if (!canSchedule && !walkin) {
    redirect(patientId ? `/appointments/new?walkin=1&patientId=${patientId}` : "/appointments/new?walkin=1");
  }
  const isWalkIn = Boolean(walkin) || !canSchedule;

  if (user.role === "DOCTOR") {
    await ensureDoctorStaff({
      hospitalId: user.hospitalId,
      appUserId: user.id,
      username: user.username,
      mobile: user.mobile,
      firstName: user.firstName,
      lastName: user.lastName,
    });
  }
  const myStaffId = actingAsDoctor
    ? view.doctorStaffId ?? (await staffIdForAppUser(user.id, user.hospitalId))
    : null;
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

  const doctorOptions = doctors.map((doctor) => ({
    id: doctor.id,
    label: doctorName(doctor),
    departmentId: doctor.departmentId,
  }));

  return (
    <AppShell title={isWalkIn ? "Walk-in registration" : "Book appointment"}>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        <Link href="/appointments" className="inline-flex text-sm text-teal-700 hover:underline">
          ← Appointments
        </Link>
        {isWalkIn && canSchedule ? (
          <Link
            href={patientId ? `/appointments/new?patientId=${patientId}` : "/appointments/new"}
            className="inline-flex text-sm text-teal-700 hover:underline"
          >
            Book a future appointment
          </Link>
        ) : null}
      </div>
      <p className="mb-3 text-sm text-slate-500">
        {isWalkIn
          ? actingAsDoctor
            ? "Today’s visit. Next you can record the fee, record vitals, or skip vitals and start the consult."
            : "Today’s visit. After this, record the consultation fee."
          : "Search a patient, then choose the doctor, date, and time."}
      </p>
      {actingAsDoctor && isWalkIn && !myStaffId ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Your doctor profile is not linked. Set it up under Hospital settings → Admin as doctor.
        </p>
      ) : (
        <AppointmentForm
          defaultQueueType={isWalkIn ? "WALK_IN" : "SCHEDULED"}
          initialPatient={patient}
          doctors={doctorOptions}
          departments={departments.map((dept) => ({ id: dept.id, label: dept.name }))}
          defaultDoctorId={actingAsDoctor ? myStaff?.id : undefined}
          lockDoctor={Boolean(isWalkIn && actingAsDoctor && myStaff?.id)}
          defaultDepartmentId={actingAsDoctor ? (myStaff?.departmentId ?? undefined) : undefined}
        />
      )}
    </AppShell>
  );
}
