import type { Appointment, Department, Patient, Staff } from "@prisma/client";
import type { HospitalActor } from "@/lib/authz/hospital";

export type AppointmentDoctor = Staff & { appUser: { username: string } | null };

export type LoadedAppointment = Appointment & {
  patient: Patient;
  doctor: AppointmentDoctor;
  department: Department;
};

export type AppointmentActionContext = {
  request: Request;
  user: HospitalActor;
  appointment: LoadedAppointment;
  body: Record<string, unknown> | null;
};

export type AppointmentActionResult =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; error: string; status: number };
