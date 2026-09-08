import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit";
import {
  DOCTOR_VISIT_ROLES,
  PRINT_SUMMARY_ROLES,
  forbidUnless,
  nextCertificateNo,
  patientName,
  requireHospitalActor,
} from "@/lib/front-desk";
import { parseCertificateInput } from "@/lib/medical-certificates";
import { prisma } from "@/lib/prisma";
import { activeSignatureFor, signatureCredentialsFor, signatureNameFor } from "@/lib/signatures";
import { hospitalScope } from "@/lib/tenancy";

export async function GET(request: Request) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  const denied = forbidUnless(scoped.user.role, PRINT_SUMMARY_ROLES);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get("patientId")?.trim() || undefined;

  const certificates = await prisma.medicalCertificate.findMany({
    where: {
      hospitalId: scoped.user.hospitalId,
      ...(patientId ? { patientId } : {}),
    },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, mrn: true } },
    },
    orderBy: { issuedAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ certificates });
}

export async function POST(request: Request) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  const denied = forbidUnless(scoped.user.role, DOCTOR_VISIT_ROLES);
  if (denied) return denied;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const parsed = parseCertificateInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const patientId = String(body?.patientId ?? "").trim();
  if (!patientId) {
    return NextResponse.json({ error: "Choose a patient." }, { status: 400 });
  }

  const scope = hospitalScope(scoped.user.hospitalId);
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, ...scope, mergedIntoId: null },
  });
  if (!patient) {
    return NextResponse.json({ error: "Patient not found." }, { status: 404 });
  }

  const appointmentId = String(body?.appointmentId ?? "").trim() || null;
  if (appointmentId) {
    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, ...scope, patientId: patient.id },
      select: { id: true },
    });
    if (!appointment) {
      return NextResponse.json({ error: "Appointment not found for this patient." }, { status: 404 });
    }
  }

  const hospital = await prisma.hospital.findUnique({
    where: { id: scoped.user.hospitalId },
    select: { code: true, requireSignatureForApproval: true },
  });
  if (!hospital) {
    return NextResponse.json({ error: "Hospital not found." }, { status: 404 });
  }

  const signature = await activeSignatureFor(scoped.user.id, scoped.user.hospitalId);
  if (!signature && hospital.requireSignatureForApproval) {
    return NextResponse.json(
      { error: "Your signature is not on file. Ask your hospital admin to upload it before issuing a certificate." },
      { status: 400 },
    );
  }

  const staff = await prisma.staff.findFirst({
    where: { appUserId: scoped.user.id, hospitalId: scoped.user.hospitalId },
  });
  const issuedByStaffId = staff?.role === "DOCTOR" ? staff.id : null;
  const displayName =
    signature?.displayName ??
    signatureNameFor({
      role: scoped.user.role,
      firstName: scoped.user.firstName,
      lastName: scoped.user.lastName,
      username: scoped.user.username,
      staffProfile: staff,
    });
  const credentials = signature?.credentials ?? signatureCredentialsFor({
    role: scoped.user.role,
    staffProfile: staff,
  });

  const certificateNo = await nextCertificateNo(scoped.user.hospitalId, hospital.code);
  const fields = parsed.data;
  const certificate = await prisma.medicalCertificate.create({
    data: {
      hospitalId: scoped.user.hospitalId,
      patientId: patient.id,
      appointmentId,
      issuedByStaffId,
      certificateNo,
      type: fields.type,
      status: "ISSUED",
      diagnosis: fields.diagnosis,
      remarks: fields.remarks,
      restFrom: fields.type === "SICK_LEAVE" ? fields.restFrom : null,
      restTo: fields.type === "SICK_LEAVE" ? fields.restTo : null,
      fitFor: fields.type === "FITNESS" ? fields.fitFor : null,
      purpose: fields.type === "GENERAL" ? fields.purpose : null,
      issuedByUserId: scoped.user.id,
      issuedByUsername: scoped.user.username,
      issuedByDisplayName: displayName,
      issuedByCredentials: credentials,
      issuedBySignatureId: signature?.id ?? null,
    },
  });

  await writeAuditLog({
    request,
    hospitalId: scoped.user.hospitalId,
    actorUserId: scoped.user.id,
    actorUsername: scoped.user.username,
    actorRole: scoped.user.role,
    action: "MEDICAL_CERTIFICATE_ISSUED",
    entity: "MedicalCertificate",
    entityId: certificate.id,
    summary: `${scoped.user.username} issued ${certificate.certificateNo} for ${patientName(patient)}.`,
    metadata: { type: certificate.type, patientId: patient.id, appointmentId },
  });

  return NextResponse.json({ ok: true, id: certificate.id, certificateNo: certificate.certificateNo });
}
