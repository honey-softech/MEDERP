import { NextResponse } from "next/server";
import type { ConsultScribeSession, ConsultScribeStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  DOCTOR_VISIT_ROLES,
  forbidUnless,
  requireHospitalActor,
  staffIdForAppUser,
} from "@/lib/front-desk";
import { isActingAsDoctor, resolveViewContext } from "@/lib/view-mode";
import { parseScribeDraft, type ScribeDraft } from "@/lib/scribe/draft-schema";

const OPEN_STATUSES: ConsultScribeStatus[] = ["RECORDING", "TRANSCRIBED"];

export type ScribeAppointment = {
  id: string;
  hospitalId: string;
  patientId: string;
  doctorId: string;
  status: string;
};

export type ScribeActor = {
  id: string;
  hospitalId: string;
  username: string;
  role: string;
};

export function scribeSessionView(session: ConsultScribeSession) {
  let draft: ScribeDraft | null = null;
  if (session.draftJson) {
    try {
      const parsed = parseScribeDraft(JSON.parse(session.draftJson) as unknown);
      if (parsed.ok) draft = parsed.draft;
    } catch {
      draft = null;
    }
  }
  return {
    id: session.id,
    status: session.status,
    transcript: session.transcript ?? "",
    translation: session.translation ?? "",
    draft,
    chunkCount: session.chunkCount,
    consentAt: session.consentAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}

export async function requireScribeAppointment(appointmentId: string) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return { ok: false as const, response: scoped.error };
  const denied = forbidUnless(scoped.user.role, DOCTOR_VISIT_ROLES);
  if (denied) return { ok: false as const, response: denied };
  const view = await resolveViewContext(scoped.user);
  if (!isActingAsDoctor(scoped.user, view.mode)) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Switch to Doctor view to use the AI scribe." }, { status: 403 }),
    };
  }

  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, hospitalId: scoped.user.hospitalId },
    select: {
      id: true,
      hospitalId: true,
      patientId: true,
      doctorId: true,
      status: true,
      hospital: { select: { aiScribeEnabled: true } },
    },
  });
  if (!appointment) {
    return { ok: false as const, response: NextResponse.json({ error: "Appointment not found." }, { status: 404 }) };
  }
  if (!appointment.hospital.aiScribeEnabled) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "AI scribe is turned off for this hospital." }, { status: 403 }),
    };
  }
  if (["CANCELLED", "NO_SHOW"].includes(appointment.status)) {
    return { ok: false as const, response: NextResponse.json({ error: "This visit cannot be recorded." }, { status: 409 }) };
  }

  const myDoctorId =
    scoped.user.role === "DOCTOR"
      ? await staffIdForAppUser(scoped.user.id, scoped.user.hospitalId)
      : view.doctorStaffId;
  if (!myDoctorId || appointment.doctorId !== myDoctorId) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "You can only record your own consults." }, { status: 403 }),
    };
  }

  return {
    ok: true as const,
    actor: {
      id: scoped.user.id,
      hospitalId: scoped.user.hospitalId,
      username: scoped.user.username,
      role: scoped.user.role,
    } satisfies ScribeActor,
    appointment: {
      id: appointment.id,
      hospitalId: appointment.hospitalId,
      patientId: appointment.patientId,
      doctorId: appointment.doctorId,
      status: appointment.status,
    } satisfies ScribeAppointment,
  };
}

export async function latestScribeSession(hospitalId: string, appointmentId: string) {
  return prisma.consultScribeSession.findFirst({
    where: { hospitalId, appointmentId, status: { not: "DISCARDED" } },
    orderBy: { createdAt: "desc" },
  });
}

export async function openScribeSession(hospitalId: string, appointmentId: string) {
  return prisma.consultScribeSession.findFirst({
    where: { hospitalId, appointmentId, status: { in: OPEN_STATUSES } },
    orderBy: { createdAt: "desc" },
  });
}

export async function scribeSessionFor(hospitalId: string, appointmentId: string, sessionId: string) {
  if (!sessionId) return null;
  return prisma.consultScribeSession.findFirst({
    where: { id: sessionId, hospitalId, appointmentId },
  });
}
