import { diffAuditFields, writeAuditLog } from "@/lib/audit";
import { FRONT_DESK_ROLES } from "@/lib/authz/hospital";
import { patientName } from "@/lib/display";
import { sanitizePhotoData } from "@/lib/opd/patients";
import { prisma } from "@/lib/prisma";
import type { AppointmentActionContext, AppointmentActionResult } from "@/lib/appointments/types";

export async function captureVisitPhoto(
  ctx: AppointmentActionContext,
): Promise<AppointmentActionResult> {
  const { request, user, appointment, body } = ctx;
  if (!FRONT_DESK_ROLES.includes(user.role)) {
    return { ok: false, error: "You do not have access to this action.", status: 403 };
  }
  const photoData = sanitizePhotoData(body?.photoData);
  if (!photoData) {
    return { ok: false, error: "Capture a photo first.", status: 400 };
  }
  const updated = await prisma.appointment.update({
    where: { id: appointment.id },
    data: { photoData },
  });
  if (!appointment.patient.photoData) {
    await prisma.patient.update({ where: { id: appointment.patientId }, data: { photoData } });
  }
  await writeAuditLog({
    request,
    hospitalId: user.hospitalId,
    actorUserId: user.id,
    actorUsername: user.username,
    actorRole: user.role,
    action: "VISIT_PHOTO_CAPTURED",
    entity: "Appointment",
    entityId: appointment.id,
    summary: `${user.username} captured a visit photo for ${patientName(appointment.patient)}.`,
    metadata: {
      changes: diffAuditFields(
        { photoData: appointment.photoData },
        { photoData: updated.photoData },
        { fields: ["photoData"] },
      ),
    },
  });
  return { ok: true, body: { ok: true, appointment: updated } };
}
