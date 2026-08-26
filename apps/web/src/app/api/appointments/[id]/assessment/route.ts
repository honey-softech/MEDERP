import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import {
  DOCTOR_VISIT_ROLES,
  doctorName,
  forbidUnless,
  patientName,
  requireHospitalActor,
  staffIdForAppUser,
  tokenLabel,
} from "@/lib/front-desk";
import { notifySummaryApproved } from "@/lib/notifications";
import { parseInvestigationPicks } from "@/lib/lab-catalog";
import { upsertVisitLabOrder } from "@/lib/lab";
import { syncPharmacyRxFromAssessment } from "@/lib/pharmacy-rx";

type Ctx = { params: Promise<{ id: string }> };

function text(value: unknown) {
  const raw = String(value ?? "").trim();
  return raw || null;
}

function followUpDate(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function POST(request: Request, context: Ctx) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  const denied = forbidUnless(scoped.user.role, DOCTOR_VISIT_ROLES);
  if (denied) return denied;

  try {
    const { id } = await context.params;
    const appointment = await prisma.appointment.findFirst({
      where: { id, hospitalId: scoped.user.hospitalId },
      include: {
        patient: true,
        doctor: { include: { appUser: { select: { username: true } } } },
        assessment: true,
      },
    });
    if (!appointment) {
      return NextResponse.json({ error: "Appointment not found." }, { status: 404 });
    }
    if (["CANCELLED", "NO_SHOW"].includes(appointment.status)) {
      return NextResponse.json({ error: "This visit cannot be assessed." }, { status: 409 });
    }
    if (scoped.user.role === "DOCTOR") {
      const staffId = await staffIdForAppUser(scoped.user.id, scoped.user.hospitalId);
      if (!staffId || appointment.doctorId !== staffId) {
        return NextResponse.json({ error: "You can only assess your own consults." }, { status: 403 });
      }
    }

    const body = await request.json().catch(() => null);
    const action = String(body?.action ?? "save");
    const followUpAt = followUpDate(body?.followUpAt);
    if (followUpAt === undefined) {
      return NextResponse.json({ error: "Follow-up date is not valid." }, { status: 400 });
    }

    if (action === "followup") {
      if (!appointment.assessment) {
        return NextResponse.json({ error: "Save the assessment before adding a follow-up." }, { status: 400 });
      }
      if (!followUpAt) {
        return NextResponse.json({ error: "Choose a follow-up date." }, { status: 400 });
      }
      const assessment = await prisma.visitAssessment.update({
        where: { id: appointment.assessment.id },
        data: { followUpAt },
      });
      return NextResponse.json({ ok: true, assessment });
    }

    if (action === "lab-tests") {
      const investigations = parseInvestigationPicks(body ?? {});
      const order = await upsertVisitLabOrder({
        hospitalId: scoped.user.hospitalId,
        appointmentId: appointment.id,
        patientId: appointment.patientId,
        orderedByUserId: scoped.user.id,
        orderedByUsername: scoped.user.username,
        investigations,
      });
      return NextResponse.json({ ok: true, order });
    }

    // Doctors may revise an approved summary and publish a new version.
    const wasApproved = appointment.assessment?.status === "APPROVED";

    const chiefComplaint = text(body?.chiefComplaint);
    const examination = text(body?.examination);
    const diagnosis = text(body?.diagnosis);
    const summary = text(body?.summary);
    const prescription = text(body?.prescription);
    const advice = text(body?.advice);
    const visitOutcomeRaw = String(body?.visitOutcome ?? "").trim().toUpperCase();
    const visitOutcome =
      visitOutcomeRaw === "FOLLOW_UP" || visitOutcomeRaw === "DISCHARGE" ? visitOutcomeRaw : null;
    const investigations = parseInvestigationPicks(body ?? {});

    const approve = action === "approve";
    if (approve) {
      if (!summary) {
        return NextResponse.json({ error: "Add a visit summary before approving." }, { status: 400 });
      }
      if (!prescription) {
        return NextResponse.json({ error: "Add a prescription before approving." }, { status: 400 });
      }
    }

    const data = {
      hospitalId: scoped.user.hospitalId,
      appointmentId: appointment.id,
      patientId: appointment.patientId,
      recordedByUserId: scoped.user.id,
      recordedByUsername: scoped.user.username,
      chiefComplaint,
      examination,
      diagnosis,
      summary,
      prescription,
      advice,
      visitOutcome,
      followUpAt,
      status: approve || wasApproved ? ("APPROVED" as const) : ("DRAFT" as const),
      approvedAt: approve ? new Date() : wasApproved ? appointment.assessment?.approvedAt ?? null : null,
      approvedByUserId: approve ? scoped.user.id : wasApproved ? appointment.assessment?.approvedByUserId ?? null : null,
      approvedByUsername: approve
        ? scoped.user.username
        : wasApproved
          ? appointment.assessment?.approvedByUsername ?? null
          : null,
    };

    const created = !appointment.assessment;
    const assessment = appointment.assessment
      ? await prisma.visitAssessment.update({ where: { id: appointment.assessment.id }, data })
      : await prisma.visitAssessment.create({ data });

    await upsertVisitLabOrder({
      hospitalId: scoped.user.hospitalId,
      appointmentId: appointment.id,
      patientId: appointment.patientId,
      orderedByUserId: scoped.user.id,
      orderedByUsername: scoped.user.username,
      investigations,
    });

    if (approve || created) {
      await writeAuditLog({
        request,
        hospitalId: scoped.user.hospitalId,
        actorUserId: scoped.user.id,
        actorUsername: scoped.user.username,
        actorRole: scoped.user.role,
        action: approve
          ? wasApproved
            ? "VISIT_SUMMARY_REPUBLISHED"
            : "VISIT_SUMMARY_APPROVED"
          : "VISIT_SUMMARY_SAVED",
        entity: "VisitAssessment",
        entityId: assessment.id,
        summary: approve
          ? wasApproved
            ? `${scoped.user.username} published a new visit summary version for ${patientName(appointment.patient)}.`
            : `${scoped.user.username} approved the visit summary for ${patientName(appointment.patient)}.`
          : `${scoped.user.username} saved a draft visit summary for ${patientName(appointment.patient)}.`,
      });
    }

    if (approve) {
      await notifySummaryApproved({
        hospitalId: scoped.user.hospitalId,
        appointmentId: appointment.id,
        patientName: patientName(appointment.patient),
        doctorName: doctorName(appointment.doctor),
        token: tokenLabel(appointment.tokenNumber),
      });
      await syncPharmacyRxFromAssessment({
        hospitalId: scoped.user.hospitalId,
        appointmentId: appointment.id,
        patientId: appointment.patientId,
        prescription: assessment.prescription,
        orderedByUsername: scoped.user.username,
      });
    }

    return NextResponse.json({ ok: true, assessment });
  } catch (error) {
    console.error("Failed to save visit assessment", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save the visit summary." },
      { status: 500 },
    );
  }
}
