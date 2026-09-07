import { NextResponse } from "next/server";
import { appointmentActionResponse } from "@/lib/appointments/http";
import { runAppointmentPatch } from "@/lib/appointments/patch";
import type { LoadedAppointment } from "@/lib/appointments/types";
import { requireHospitalActor } from "@/lib/authz/hospital";
import { prisma } from "@/lib/prisma";
import { appointmentPatchSchema } from "@/lib/validation/appointment";
import { invalidBody, parseUnknown } from "@/lib/validation/parse";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Ctx) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  const user = scoped.user;

  const { id } = await context.params;
  const appointment = await prisma.appointment.findFirst({
    where: { id, hospitalId: user.hospitalId },
    include: { patient: true, doctor: { include: { appUser: { select: { username: true } } } }, department: true },
  });
  if (!appointment) {
    return NextResponse.json({ error: "Appointment not found." }, { status: 404 });
  }

  const raw = await request.json().catch(() => null);
  const parsed = parseUnknown(raw, appointmentPatchSchema);
  if (!parsed.ok) return invalidBody(parsed.error);

  const result = await runAppointmentPatch(parsed.data.action, {
    request,
    user,
    appointment: appointment as LoadedAppointment,
    body: parsed.data as unknown as Record<string, unknown>,
  });
  return appointmentActionResponse(result);
}
