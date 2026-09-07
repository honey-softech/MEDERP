import { staffIdForAppUser } from "@/lib/opd/scheduling";
import type { AppointmentActionContext, AppointmentActionResult } from "@/lib/appointments/types";

export async function doctorOwnsVisit(
  ctx: AppointmentActionContext,
): Promise<AppointmentActionResult | null> {
  const { user, appointment } = ctx;
  if (user.role === "SUPER_ADMIN") return null;
  const staffId = await staffIdForAppUser(user.id, user.hospitalId);
  if (!staffId || appointment.doctorId !== staffId) {
    return { ok: false, error: "You can only update your own consults.", status: 403 };
  }
  return null;
}
