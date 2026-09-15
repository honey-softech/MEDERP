import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import {
  listDoctorAvailability,
  minuteToTimeLabel,
  normalizeAvailabilityWindows,
  replaceDoctorAvailability,
} from "@/lib/doctor-availability";
import { prisma } from "@/lib/prisma";
import { routeParam } from "@/lib/route-param";

async function loadDoctorInHospital(staffId: string, hospitalId: string) {
  return prisma.staff.findFirst({
    where: { id: staffId, hospitalId, role: "DOCTOR" },
    select: { id: true, firstName: true, lastName: true, hospitalId: true },
  });
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user?.hospitalId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!["SUPER_ADMIN", "RECEPTIONIST", "DOCTOR", "NURSE"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const staffId = await routeParam(context.params, "id");
  const doctor = await loadDoctorInHospital(staffId, user.hospitalId);
  if (!doctor) {
    return NextResponse.json({ error: "Doctor not found." }, { status: 404 });
  }

  const windows = await listDoctorAvailability(doctor.id);
  return NextResponse.json({
    doctorId: doctor.id,
    windows: windows.map((w) => ({
      id: w.id,
      dayOfWeek: w.dayOfWeek,
      startMinute: w.startMinute,
      endMinute: w.endMinute,
      startTime: minuteToTimeLabel(w.startMinute),
      endTime: minuteToTimeLabel(w.endMinute),
    })),
  });
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user?.hospitalId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Only hospital super admin can edit doctor availability." }, { status: 403 });
  }

  const staffId = await routeParam(context.params, "id");
  const doctor = await loadDoctorInHospital(staffId, user.hospitalId);
  if (!doctor) {
    return NextResponse.json({ error: "Doctor not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = normalizeAvailabilityWindows(body?.windows);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const windows = await replaceDoctorAvailability(doctor.id, parsed.windows);
  void writeAuditLog({
    request,
    hospitalId: user.hospitalId,
    actorUserId: user.id,
    actorUsername: user.username,
    actorRole: user.role,
    action: "DOCTOR_AVAILABILITY_UPDATED",
    entity: "Staff",
    entityId: doctor.id,
    summary: `${user.username} updated availability for Dr ${doctor.firstName} ${doctor.lastName} (${windows.length} window(s)).`,
    metadata: { windowCount: windows.length },
  });

  return NextResponse.json({
    ok: true,
    doctorId: doctor.id,
    windows: windows.map((w) => ({
      id: w.id,
      dayOfWeek: w.dayOfWeek,
      startMinute: w.startMinute,
      endMinute: w.endMinute,
      startTime: minuteToTimeLabel(w.startMinute),
      endTime: minuteToTimeLabel(w.endMinute),
    })),
  });
}
