import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { deliverMessage, messagingProvider } from "@/lib/messaging/providers";
import { uploadWhatsAppDocument } from "@/lib/messaging/whatsapp-media";
import { renderTemplate } from "@/lib/messaging/templates";
import { printClock } from "@/lib/print-document-pdf";
import { toVitalsValues } from "@/lib/vitals";
import { generalExaminationRows } from "@/lib/visit-summary";
import { buildVisitSummaryPdf } from "@/lib/visit-summary-pdf";
import {
  doctorName,
  patientName,
  PRINT_SUMMARY_ROLES,
  requireHospitalActor,
} from "@/lib/front-desk";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  if (!PRINT_SUMMARY_ROLES.includes(scoped.user.role)) {
    return NextResponse.json({ error: "You cannot send visit summaries." }, { status: 403 });
  }

  const { id } = await context.params;
  const payload = await request.json().catch(() => null);
  const requested = String(payload?.channel ?? "WHATSAPP").toUpperCase();
  const channel = requested === "SMS" ? "WHATSAPP" : requested;
  if (channel !== "WHATSAPP") {
    return NextResponse.json({ error: "Choose WhatsApp." }, { status: 400 });
  }

  const appointment = await prisma.appointment.findFirst({
    where: { id, hospitalId: scoped.user.hospitalId },
    include: {
      patient: true,
      hospital: { select: { name: true, address: true, phone: true, code: true, logoData: true, sealData: true } },
      doctor: { include: { appUser: { select: { username: true } } } },
      department: { select: { name: true } },
      vitals: true,
      assessment: { include: { approvedBySignature: { select: { imageData: true } } } },
    },
  });
  if (!appointment) {
    return NextResponse.json({ error: "Appointment not found." }, { status: 404 });
  }
  if (!appointment.assessment || appointment.assessment.status !== "APPROVED") {
    return NextResponse.json(
      { error: "Approve the visit summary before sending it on WhatsApp." },
      { status: 400 },
    );
  }

  const phone = appointment.patient.phone?.replace(/\D/g, "") ?? "";
  if (phone.length < 10) {
    return NextResponse.json({ error: "Add a 10-digit mobile number on the patient record first." }, { status: 400 });
  }

  const when = appointment.scheduledAt.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const variables = {
    patient: patientName(appointment.patient),
    hospital: appointment.hospital.name,
    doctor: doctorName(appointment.doctor),
    when,
  };
  const body = renderTemplate("visit_summary", variables);
  const filename = `visit-summary-${appointment.patient.mrn}.pdf`;

  const pdf = await buildVisitSummaryPdf({
    hospital: appointment.hospital,
    patient: appointment.patient,
    doctor: appointment.doctor,
    departmentName: appointment.department.name,
    visitType: appointment.visitType,
    scheduledAt: appointment.scheduledAt,
    tokenNumber: appointment.tokenNumber,
    vitalsRows: generalExaminationRows(appointment.vitals ? toVitalsValues(appointment.vitals) : null),
    printedAt: printClock(),
    assessment: appointment.assessment,
  });

  let documentMediaId: string | undefined;
  if (messagingProvider() === "whatsapp") {
    const uploaded = await uploadWhatsAppDocument({ buffer: pdf, filename });
    if (!uploaded.ok) {
      return NextResponse.json({ error: uploaded.error }, { status: 502 });
    }
    documentMediaId = uploaded.mediaId;
  }

  const result = await deliverMessage({
    toPhone: phone,
    channel: "WHATSAPP",
    body,
    templateKey: "visit_summary",
    variables,
    documentMediaId,
    documentFilename: filename,
  });

  const outbound = await prisma.outboundMessage.create({
    data: {
      hospitalId: scoped.user.hospitalId,
      patientId: appointment.patientId,
      appointmentId: appointment.id,
      channel: "WHATSAPP",
      templateKey: "visit_summary",
      variables: variables as Prisma.InputJsonValue,
      toPhone: phone,
      body,
      status: result.ok ? "SENT" : "FAILED",
      attempts: 1,
      providerMessageId: result.ok ? (result.providerMessageId ?? null) : null,
      error: result.ok ? null : result.error,
      sentAt: result.ok ? new Date() : null,
    },
  });

  await writeAuditLog({
    request,
    hospitalId: scoped.user.hospitalId,
    actorUserId: scoped.user.id,
    actorUsername: scoped.user.username,
    actorRole: scoped.user.role,
    action: result.ok ? "VISIT_SUMMARY_SENT" : "VISIT_SUMMARY_FAILED",
    entity: "Appointment",
    entityId: appointment.id,
    summary: result.ok
      ? `${scoped.user.username} sent WhatsApp visit summary PDF to ${patientName(appointment.patient)}.`
      : `${scoped.user.username} failed to send WhatsApp visit summary: ${result.error}`,
    metadata: { outboundMessageId: outbound.id, providerMessageId: result.ok ? result.providerMessageId : null },
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true, status: "SENT", providerMessageId: result.providerMessageId });
}
