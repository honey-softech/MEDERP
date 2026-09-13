import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { deliverMessage, messagingProvider } from "@/lib/messaging/providers";
import { uploadWhatsAppDocument } from "@/lib/messaging/whatsapp-media";
import { renderTemplate } from "@/lib/messaging/templates";
import { buildMedicalCertificatePdf } from "@/lib/medical-certificate-pdf";
import { certificateTitle, formatCertDate } from "@/lib/medical-certificates";
import { patientName, PRINT_SUMMARY_ROLES, requireHospitalActor } from "@/lib/front-desk";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  if (!PRINT_SUMMARY_ROLES.includes(scoped.user.role)) {
    return NextResponse.json({ error: "You cannot send medical certificates." }, { status: 403 });
  }

  const { id } = await context.params;
  const payload = await request.json().catch(() => null);
  const requested = String(payload?.channel ?? "WHATSAPP").toUpperCase();
  const channel = requested === "SMS" ? "WHATSAPP" : requested;
  if (channel !== "WHATSAPP") {
    return NextResponse.json({ error: "Choose WhatsApp." }, { status: 400 });
  }

  const certificate = await prisma.medicalCertificate.findFirst({
    where: { id, hospitalId: scoped.user.hospitalId },
    include: {
      patient: true,
      hospital: {
        select: { name: true, address: true, phone: true, code: true, logoData: true, sealData: true },
      },
      issuedBySignature: { select: { imageData: true } },
    },
  });
  if (!certificate) {
    return NextResponse.json({ error: "Certificate not found." }, { status: 404 });
  }
  if (certificate.status !== "ISSUED") {
    return NextResponse.json({ error: "Only issued certificates can be sent." }, { status: 400 });
  }

  const phone = certificate.patient.phone?.replace(/\D/g, "") ?? "";
  if (phone.length < 10) {
    return NextResponse.json({ error: "Add a 10-digit mobile number on the patient record first." }, { status: 400 });
  }

  const variables = {
    patient: patientName(certificate.patient),
    hospital: certificate.hospital.name,
    doctor: certificate.issuedByDisplayName || certificate.issuedByUsername,
    when: formatCertDate(certificate.issuedAt),
    type: certificateTitle(certificate.type),
  };
  const body = renderTemplate("medical_certificate", variables);
  const filename = `medical-certificate-${certificate.certificateNo}.pdf`;

  const pdf = await buildMedicalCertificatePdf({
    hospital: certificate.hospital,
    patient: certificate.patient,
    certificate,
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
    templateKey: "medical_certificate",
    variables,
    documentMediaId,
    documentFilename: filename,
  });

  const outbound = await prisma.outboundMessage.create({
    data: {
      hospitalId: scoped.user.hospitalId,
      patientId: certificate.patientId,
      appointmentId: certificate.appointmentId,
      channel: "WHATSAPP",
      templateKey: "medical_certificate",
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
    action: result.ok ? "MEDICAL_CERTIFICATE_SENT" : "MEDICAL_CERTIFICATE_SEND_FAILED",
    entity: "MedicalCertificate",
    entityId: certificate.id,
    summary: result.ok
      ? `${scoped.user.username} sent WhatsApp medical certificate ${certificate.certificateNo} to ${patientName(certificate.patient)}.`
      : `${scoped.user.username} failed to send medical certificate: ${result.error}`,
    metadata: { outboundMessageId: outbound.id, providerMessageId: result.ok ? result.providerMessageId : null },
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true, status: "SENT", providerMessageId: result.providerMessageId });
}
