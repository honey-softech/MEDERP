import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { diffAuditFields, writeAuditLog } from "@/lib/audit";
import { LAB_VIEW_ROLES, LAB_WORK_ROLES, forbidUnless, patientName, requireHospitalActor } from "@/lib/front-desk";
import { notifyLabResults } from "@/lib/lab";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Ctx) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  const denied = forbidUnless(scoped.user.role, LAB_VIEW_ROLES);
  if (denied) return denied;
  const { id } = await context.params;
  const order = await prisma.labOrder.findFirst({
    where: { id, hospitalId: scoped.user.hospitalId },
    include: {
      patient: true,
      items: { include: { test: { select: { code: true } } } },
      appointment: { select: { id: true, tokenNumber: true } },
    },
  });
  if (!order) {
    return NextResponse.json({ error: "Lab order not found." }, { status: 404 });
  }
  return NextResponse.json({ order });
}

export async function PATCH(request: Request, context: Ctx) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  const denied = forbidUnless(scoped.user.role, LAB_WORK_ROLES);
  if (denied) return denied;

  const { id } = await context.params;
  const order = await prisma.labOrder.findFirst({
    where: { id, hospitalId: scoped.user.hospitalId },
    include: {
      items: true,
      patient: true,
      appointment: { include: { doctor: { select: { appUserId: true } } } },
    },
  });
  if (!order) {
    return NextResponse.json({ error: "Lab order not found." }, { status: 404 });
  }
  if (order.fulfillment === "EXTERNAL") {
    return NextResponse.json({ error: "This investigation is done outside the hospital lab." }, { status: 409 });
  }

  const body = await request.json().catch(() => null);
  const action = String(body?.action ?? "").trim();

  if (action === "collect-sample") {
    if (order.status !== "PAID" && order.status !== "SAMPLE_COLLECTED") {
      return NextResponse.json({ error: "Collect payment at reception before drawing the sample." }, { status: 409 });
    }
    const updated = await prisma.labOrder.update({
      where: { id: order.id },
      data: {
        status: "SAMPLE_COLLECTED",
        sampleCollectedAt: new Date(),
        sampleCollectedBy: scoped.user.username,
        notes: String(body?.notes ?? order.notes ?? "").trim() || null,
      },
    });
    await writeAuditLog({
      request,
      hospitalId: scoped.user.hospitalId,
      actorUserId: scoped.user.id,
      actorUsername: scoped.user.username,
      actorRole: scoped.user.role,
      action: "LAB_SAMPLE_COLLECTED",
      entity: "LabOrder",
      entityId: order.id,
      summary: `${scoped.user.username} collected lab samples for ${patientName(order.patient)}.`,
      metadata: {
        changes: diffAuditFields(
          { status: order.status, sampleCollectedBy: order.sampleCollectedBy, notes: order.notes },
          { status: updated.status, sampleCollectedBy: updated.sampleCollectedBy, notes: updated.notes },
          { fields: ["status", "sampleCollectedBy", "notes"] },
        ),
      },
    });
    return NextResponse.json({ ok: true, order: updated });
  }

  if (action === "save-results" || action === "mark-done") {
    if (order.status === "AWAITING_PAYMENT" || order.status === "CANCELLED") {
      return NextResponse.json({ error: "Collect payment before marking lab work done." }, { status: 409 });
    }
    if (!order.reportFileName) {
      return NextResponse.json({ error: "Upload the lab report document before marking this done." }, { status: 400 });
    }
    const now = new Date();
    const updated = await prisma.labOrder.update({
      where: { id: order.id },
      data: {
        status: "RESULTED",
        sampleCollectedAt: order.sampleCollectedAt ?? now,
        sampleCollectedBy: order.sampleCollectedBy ?? scoped.user.username,
        resultedAt: now,
        notes: String(body?.notes ?? order.notes ?? "").trim() || null,
      },
    });

    if (order.status !== "RESULTED") {
      await notifyLabResults({
        hospitalId: scoped.user.hospitalId,
        appointmentId: order.appointmentId,
        orderId: order.id,
        patientId: order.patientId,
        patientName: patientName(order.patient),
        doctorUserId: order.appointment?.doctor.appUserId ?? null,
      });
    }

    await writeAuditLog({
      request,
      hospitalId: scoped.user.hospitalId,
      actorUserId: scoped.user.id,
      actorUsername: scoped.user.username,
      actorRole: scoped.user.role,
      action: "LAB_RESULTS_SAVED",
      entity: "LabOrder",
      entityId: order.id,
      summary: `${scoped.user.username} marked lab work done for ${patientName(order.patient)}.`,
      metadata: {
        changes: diffAuditFields(
          { status: order.status, notes: order.notes },
          { status: updated.status, notes: updated.notes },
          { fields: ["status", "notes"] },
        ),
      },
    });
    return NextResponse.json({ ok: true, order: updated });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
