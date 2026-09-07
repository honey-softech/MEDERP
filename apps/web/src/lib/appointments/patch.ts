import { captureVisitPhoto } from "@/lib/appointments/photo";
import { remindAppointment } from "@/lib/appointments/remind";
import { rescheduleAppointment } from "@/lib/appointments/reschedule";
import {
  cancelAppointment,
  checkInAppointment,
  closeAppointment,
  markNoShow,
  startAppointment,
} from "@/lib/appointments/status";
import type { AppointmentActionContext, AppointmentActionResult } from "@/lib/appointments/types";

export async function runAppointmentPatch(
  action: string,
  ctx: AppointmentActionContext,
): Promise<AppointmentActionResult> {
  if (action === "reschedule") return rescheduleAppointment(ctx);
  if (action === "cancel") return cancelAppointment(ctx);
  if (action === "checkin") return checkInAppointment(ctx);
  if (action === "start") return startAppointment(ctx);
  if (action === "checkout" || action === "complete") return closeAppointment(ctx, action);
  if (action === "noshow") return markNoShow(ctx);
  if (action === "remind") return remindAppointment(ctx);
  if (action === "photo") return captureVisitPhoto(ctx);
  return { ok: false, error: "Unknown appointment action.", status: 400 };
}
