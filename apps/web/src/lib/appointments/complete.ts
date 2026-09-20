import { diffAuditFields, writeAuditLog } from "@/lib/audit";
import { patientName } from "@/lib/display";
import { prisma } from "@/lib/prisma";

export async function markAppointmentCompleted(
  ctx: {
    request?: Request;
    user: { id: string; username: string; role: string; hospitalId: string };
    appointment: {
      id: string;
      status: string;
      checkOutAt: Date | null;
      patient: Parameters<typeof patientName>[0];
    };
  },
  action: "checkout" | "complete" = "complete",
) {
  const { request, user, appointment } = ctx;
  const current = await prisma.appointment.findUnique({
    where: { id: appointment.id },
    select: { status: true, checkOutAt: true },
  });
  if (!current || ["CANCELLED", "COMPLETED", "NO_SHOW"].includes(current.status)) {
    return appointment;
  }
  const updated = await prisma.appointment.update({
    where: { id: appointment.id },
    data: { status: "COMPLETED", checkOutAt: new Date() },
  });
  await writeAuditLog({
    request,
    hospitalId: user.hospitalId,
    actorUserId: user.id,
    actorUsername: user.username,
    actorRole: user.role,
    action: action === "complete" ? "VISIT_COMPLETED" : "PATIENT_CHECKED_OUT",
    entity: "Appointment",
    entityId: appointment.id,
    summary:
      action === "complete"
        ? `${user.username} marked visit done for ${patientName(appointment.patient)}.`
        : `${user.username} checked out ${patientName(appointment.patient)}.`,
    metadata: {
      changes: diffAuditFields(
        { status: current.status, checkOutAt: current.checkOutAt },
        { status: updated.status, checkOutAt: updated.checkOutAt },
        { fields: ["status", "checkOutAt"] },
      ),
    },
  });
  return updated;
}
