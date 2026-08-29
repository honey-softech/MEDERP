import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit";
import { enqueueMessage } from "@/lib/messaging";
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
  const channel = String(payload?.channel ?? "SMS").toUpperCase();
  if (channel !== "SMS" && channel !== "WHATSAPP") {
    return NextResponse.json({ error: "Choose SMS or WhatsApp." }, { status: 400 });
  }

  const appointment = await prisma.appointment.findFirst({
    where: { id, hospitalId: scoped.user.hospitalId },
    include: {
      patient: true,
      hospital: { select: { name: true } },
      labOrders: {
        where: { status: { not: "CANCELLED" } },
        include: { items: true },
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

  const items = appointment.labOrders
    .flatMap((order) => order.items.map((item) => item.nameSnapshot))
    .filter(Boolean);
  if (items.length === 0) {
    return NextResponse.json({ error: "No investigations to send." }, { status: 400 });
  }

  const queued = await enqueueMessage({
    hospitalId: scoped.user.hospitalId,
    patientId: appointment.patientId,
    appointmentId: appointment.id,
    channel,
    templateKey: "investigation_list",
    variables: {
      patient: patientName(appointment.patient),
      hospital: appointment.hospital.name,
      items: items.join(", "),
    },
    toPhone: phone,
    patient: appointment.patient,
  });
  if ("error" in queued) {
    return NextResponse.json({ error: queued.error }, { status: 400 });
  }

  await writeAuditLog({
    request,
    hospitalId: scoped.user.hospitalId,
    actorUserId: scoped.user.id,
    actorUsername: scoped.user.username,
    actorRole: scoped.user.role,
    action: "INVESTIGATION_LIST_QUEUED",
    entity: "Appointment",
    entityId: appointment.id,
    summary: `${scoped.user.username} queued a ${channel} investigation list for ${patientName(appointment.patient)}.`,
  });

  return NextResponse.json({ ok: true, status: "PENDING" });
}
