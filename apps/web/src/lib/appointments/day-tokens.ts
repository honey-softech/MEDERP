import { prisma } from "@/lib/prisma";
import { dayRange } from "@/lib/opd/scheduling";

export type DayTokenVisit = {
  id: string;
  scheduledAt: Date;
  createdAt: Date;
  queueType: string;
  status: string;
};

function byAppointmentTime(a: DayTokenVisit, b: DayTokenVisit) {
  const time = a.scheduledAt.getTime() - b.scheduledAt.getTime();
  if (time !== 0) return time;
  return a.createdAt.getTime() - b.createdAt.getTime();
}

/** True when `other` falls on a different local calendar day from `day`. */
export function onDifferentTokenDay(day: Date, other: Date) {
  const { start, end } = dayRange(day);
  return other < start || other >= end;
}

/**
 * Scheduled visits take T-001 onward, in appointment-time order across every
 * session that day. Walk-ins are numbered only after that block.
 * Cancelled and no-show visits are left out.
 */
export function assignDayTokens(visits: DayTokenVisit[]) {
  const active = visits.filter((visit) => visit.status !== "CANCELLED" && visit.status !== "NO_SHOW");
  const scheduled = active.filter((visit) => visit.queueType !== "WALK_IN").sort(byAppointmentTime);
  const walkIns = active.filter((visit) => visit.queueType === "WALK_IN").sort(byAppointmentTime);
  return [...scheduled, ...walkIns].map((visit, index) => ({
    id: visit.id,
    tokenNumber: index + 1,
  }));
}

export async function resequenceDoctorDayTokens(params: {
  hospitalId: string;
  doctorId: string;
  at: Date;
}) {
  const { start, end } = dayRange(params.at);
  const rows = await prisma.appointment.findMany({
    where: {
      hospitalId: params.hospitalId,
      doctorId: params.doctorId,
      scheduledAt: { gte: start, lt: end },
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
    },
    select: {
      id: true,
      scheduledAt: true,
      createdAt: true,
      queueType: true,
      status: true,
      tokenNumber: true,
    },
  });
  const assigned = assignDayTokens(rows);
  const changes = assigned.filter((row) => rows.find((current) => current.id === row.id)?.tokenNumber !== row.tokenNumber);
  if (changes.length > 0) {
    await prisma.$transaction(
      changes.map((row) =>
        prisma.appointment.update({
          where: { id: row.id },
          data: { tokenNumber: row.tokenNumber },
        }),
      ),
    );
  }
  return assigned;
}
