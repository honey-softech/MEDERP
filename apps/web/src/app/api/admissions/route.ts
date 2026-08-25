import { NextResponse } from "next/server";
import type { PaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { forbidUnless, patientName, requireHospitalActor } from "@/lib/front-desk";
import { notifyWardStaffOfAdmission } from "@/lib/notifications";
import {
  ACTIVE_ADMISSION_STATUSES,
  WARD_ADMIT_ROLES,
  WARD_VIEW_ROLES,
  admissionInclude,
  admitPatient,
  assertWardsModuleEnabled,
  isAdmissionType,
  wardErrorResponse,
} from "@/lib/wards";

export async function GET(request: Request) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  const denied = forbidUnless(scoped.user.role, WARD_VIEW_ROLES);
  if (denied) return denied;

  try {
    await assertWardsModuleEnabled(scoped.user.hospitalId);
  } catch (error) {
    return wardErrorResponse(error);
  }

  const { searchParams } = new URL(request.url);
  const active = searchParams.get("active") !== "0";
  const patientId = searchParams.get("patientId") ?? undefined;

  const admissions = await prisma.admission.findMany({
    where: {
      hospitalId: scoped.user.hospitalId,
      ...(patientId ? { patientId } : {}),
      ...(active ? { status: { in: [...ACTIVE_ADMISSION_STATUSES] } } : {}),
    },
    orderBy: { admittedAt: "desc" },
    take: active ? 200 : 80,
    include: admissionInclude,
  });

  return NextResponse.json({ admissions });
}

export async function POST(request: Request) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  const denied = forbidUnless(scoped.user.role, WARD_ADMIT_ROLES);
  if (denied) return denied;

  try {
    await assertWardsModuleEnabled(scoped.user.hospitalId);
  } catch (error) {
    return wardErrorResponse(error);
  }

  const hospital = scoped.user.hospital ?? (await prisma.hospital.findUnique({ where: { id: scoped.user.hospitalId } }));
  if (!hospital) return NextResponse.json({ error: "Hospital not found." }, { status: 400 });

  const body = await request.json().catch(() => null);
  const type = String(body?.type ?? "ELECTIVE");
  if (!isAdmissionType(type)) {
    return NextResponse.json({ error: "Invalid admission type." }, { status: 400 });
  }

  const expected = body?.expectedDischargeAt ? new Date(String(body.expectedDischargeAt)) : null;
  if (expected && Number.isNaN(expected.getTime())) {
    return NextResponse.json({ error: "Enter a valid expected discharge date." }, { status: 400 });
  }

  try {
    const admission = await admitPatient({
      hospitalId: scoped.user.hospitalId,
      hospitalCode: hospital.code,
      patientId: String(body?.patientId ?? ""),
      bedId: String(body?.bedId ?? ""),
      type,
      diagnosis: body?.diagnosis != null ? String(body.diagnosis) : null,
      notes: body?.notes != null ? String(body.notes) : null,
      attendantName: body?.attendantName != null ? String(body.attendantName) : null,
      attendantPhone: body?.attendantPhone != null ? String(body.attendantPhone) : null,
      admittingDoctorId: body?.admittingDoctorId ? String(body.admittingDoctorId) : null,
      attendingDoctorId: body?.attendingDoctorId ? String(body.attendingDoctorId) : null,
      departmentId: body?.departmentId ? String(body.departmentId) : null,
      sourceAppointmentId: body?.sourceAppointmentId ? String(body.sourceAppointmentId) : null,
      expectedDischargeAt: expected,
      advanceAmount: Number(body?.advanceAmount ?? 0),
      advanceMethod: body?.advanceMethod ? (String(body.advanceMethod) as PaymentMethod) : null,
      receivedByUserId: scoped.user.id,
    });

    await writeAuditLog({
      request,
      hospitalId: scoped.user.hospitalId,
      actorUserId: scoped.user.id,
      actorUsername: scoped.user.username,
      actorRole: scoped.user.role,
      action: "PATIENT_ADMITTED",
      entity: "Admission",
      entityId: admission.id,
      summary: `${scoped.user.username} admitted ${patientName(admission.patient)} as ${admission.ipNumber} to ${admission.bed.ward.name} ${admission.bed.number}.`,
    });

    await notifyWardStaffOfAdmission({
      hospitalId: scoped.user.hospitalId,
      admissionId: admission.id,
      patientName: patientName(admission.patient),
      ipNumber: admission.ipNumber,
      bedLabel: `${admission.bed.ward.name} · ${admission.bed.number}`,
    });

    return NextResponse.json({ admission });
  } catch (error) {
    return wardErrorResponse(error);
  }
}
