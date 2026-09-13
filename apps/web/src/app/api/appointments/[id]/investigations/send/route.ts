import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { buildInvestigationListPdf } from "@/lib/investigation-list-pdf";
import { clipWhatsAppVar, renderTemplate } from "@/lib/messaging/templates";
import { deliverMessage, messagingProvider } from "@/lib/messaging/providers";
import { uploadWhatsAppDocument } from "@/lib/messaging/whatsapp-media";
import { patientName, PRINT_SUMMARY_ROLES, requireHospitalActor } from "@/lib/front-desk";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  if (!PRINT_SUMMARY_ROLES.includes(scoped.user.role)) {
    return NextResponse.json({ error: "You cannot send investigation lists." }, { status: 403 });
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
      hospital: { select: { name: true, address: true, phone: true } },
      doctor: { include: { appUser: { select: { username: true } } } },
      department: { select: { name: true } },
      assessment: { select: { status: true } },
      labOrders: {
        where: { status: { not: "CANCELLED" } },
        include: {
          items: true,
          orderedBySignature: { select: { displayName: true, credentials: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!appointment) {
    return NextResponse.json({ error: "Appointment not found." }, { status: 404 });
  }

  const phone = appointment.patient.phone?.replace(/\D/g, "") ?? "";
  if (phone.length < 10) {
    return NextResponse.json({ error: "Add a 10-digit mobile number on the patient record first." }, { status: 400 });
  }

  const items = appointment.labOrders.flatMap((order) =>
    order.items.map((item) => ({
      name: item.nameSnapshot,
      category: item.categorySnapshot,
      outside: order.fulfillment === "EXTERNAL",
    })),
  );
  if (items.length === 0) {
    return NextResponse.json({ error: "No investigations to send." }, { status: 400 });
  }

  const signed = appointment.assessment?.status === "APPROVED";
  const signature = signed
    ? appointment.labOrders.find((order) => order.orderedBySignature)?.orderedBySignature
    : null;
  const variables = {
    patient: patientName(appointment.patient),
    hospital: appointment.hospital.name,
    items: clipWhatsAppVar(items.map((item) => item.name).join(", ")),
  };
  const body = renderTemplate("investigation_list", variables);
  const filename = `investigation-list-${appointment.patient.mrn}.pdf`;

  const pdf = await buildInvestigationListPdf({
    hospital: appointment.hospital,
    patient: appointment.patient,
    doctor: appointment.doctor,
    departmentName: appointment.department.name,
    scheduledAt: appointment.scheduledAt,
    tokenNumber: appointment.tokenNumber,
    items,
    requestedBy: signature?.displayName,
    requestedByCredentials: signature?.credentials,
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
    templateKey: "investigation_list",
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
      templateKey: "investigation_list",
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
    action: result.ok ? "INVESTIGATION_LIST_SENT" : "INVESTIGATION_LIST_FAILED",
    entity: "Appointment",
    entityId: appointment.id,
    summary: result.ok
      ? `${scoped.user.username} sent WhatsApp investigation list PDF to ${patientName(appointment.patient)}.`
      : `${scoped.user.username} failed to send WhatsApp investigation list: ${result.error}`,
    metadata: { outboundMessageId: outbound.id, providerMessageId: result.ok ? result.providerMessageId : null },
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true, status: "SENT", providerMessageId: result.providerMessageId });
}
