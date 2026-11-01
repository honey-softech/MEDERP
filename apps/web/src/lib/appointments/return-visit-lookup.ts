import { prisma } from "@/lib/prisma";

function returnVisitId(value: string | undefined) {
  if (!value || !/^[a-zA-Z0-9_-]{8,64}$/.test(value)) return null;
  return value;
}

/** Another visit for this patient, used as the way back to the assessment in progress. */
export async function resolveReturnVisit({
  hospitalId,
  patientId,
  currentAppointmentId,
  returnVisit,
}: {
  hospitalId: string;
  patientId: string;
  currentAppointmentId: string;
  returnVisit: string | undefined;
}) {
  const requested = returnVisitId(returnVisit);
  if (!requested || requested === currentAppointmentId) return null;
  const row = await prisma.appointment.findFirst({
    where: { id: requested, hospitalId, patientId },
    select: { id: true },
  });
  return row?.id ?? null;
}
