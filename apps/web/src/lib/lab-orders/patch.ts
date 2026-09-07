import { diffAuditFields, writeAuditLog } from "@/lib/audit";
import type { HospitalActor } from "@/lib/authz/hospital";
import { patientName } from "@/lib/display";
import { notifyLabResults } from "@/lib/lab";
import {
  canCollectSample,
  canSaveLabResults,
  inHouseLabBlocked,
  requiresReportBeforeDone,
} from "@/lib/lab-orders/rules";
import type { LabActionResult } from "@/lib/lab-orders/types";
import { prisma } from "@/lib/prisma";
import { hospitalScope } from "@/lib/tenancy";

export async function runLabOrderPatch(params: {
  request: Request;
  user: HospitalActor;
  orderId: string;
  action: string;
  notes?: unknown;
}): Promise<LabActionResult> {
  const order = await prisma.labOrder.findFirst({
    where: { id: params.orderId, ...hospitalScope(params.user.hospitalId) },
    include: {
      items: true,
      patient: true,
      appointment: { include: { doctor: { select: { appUserId: true } } } },
    },
  });
  if (!order) {
    return { ok: false, error: "Lab order not found.", status: 404 };
  }
  if (inHouseLabBlocked(order.fulfillment)) {
    return { ok: false, error: "This investigation is done outside the hospital lab.", status: 409 };
  }

  if (params.action === "collect-sample") {
    if (!canCollectSample(order.status)) {
      return { ok: false, error: "Collect payment at reception before drawing the sample.", status: 409 };
    }
    const updated = await prisma.labOrder.update({
      where: { id: order.id },
      data: {
        status: "SAMPLE_COLLECTED",
        sampleCollectedAt: new Date(),
        sampleCollectedBy: params.user.username,
        notes: String(params.notes ?? order.notes ?? "").trim() || null,
      },
    });
    await writeAuditLog({
      request: params.request,
      hospitalId: params.user.hospitalId,
      actorUserId: params.user.id,
      actorUsername: params.user.username,
      actorRole: params.user.role,
      action: "LAB_SAMPLE_COLLECTED",
      entity: "LabOrder",
      entityId: order.id,
      summary: `${params.user.username} collected lab samples for ${patientName(order.patient)}.`,
      metadata: {
        changes: diffAuditFields(
          { status: order.status, sampleCollectedBy: order.sampleCollectedBy, notes: order.notes },
          { status: updated.status, sampleCollectedBy: updated.sampleCollectedBy, notes: updated.notes },
          { fields: ["status", "sampleCollectedBy", "notes"] },
        ),
      },
    });
    return { ok: true, body: { ok: true, order: updated } };
  }

  if (params.action === "save-results" || params.action === "mark-done") {
    if (!canSaveLabResults(order.status)) {
      return { ok: false, error: "Collect payment before marking lab work done.", status: 409 };
    }
    if (requiresReportBeforeDone(order.reportFileName)) {
      return { ok: false, error: "Upload the lab report document before marking this done.", status: 400 };
    }
    const now = new Date();
    const updated = await prisma.labOrder.update({
      where: { id: order.id },
      data: {
        status: "RESULTED",
        sampleCollectedAt: order.sampleCollectedAt ?? now,
        sampleCollectedBy: order.sampleCollectedBy ?? params.user.username,
        resultedAt: now,
        notes: String(params.notes ?? order.notes ?? "").trim() || null,
      },
    });

    if (order.status !== "RESULTED") {
      await notifyLabResults({
        hospitalId: params.user.hospitalId,
        appointmentId: order.appointmentId,
        orderId: order.id,
        patientId: order.patientId,
        patientName: patientName(order.patient),
        doctorUserId: order.appointment?.doctor.appUserId ?? null,
      });
    }

    await writeAuditLog({
      request: params.request,
      hospitalId: params.user.hospitalId,
      actorUserId: params.user.id,
      actorUsername: params.user.username,
      actorRole: params.user.role,
      action: "LAB_RESULTS_SAVED",
      entity: "LabOrder",
      entityId: order.id,
      summary: `${params.user.username} marked lab work done for ${patientName(order.patient)}.`,
      metadata: {
        changes: diffAuditFields(
          { status: order.status, notes: order.notes },
          { status: updated.status, notes: updated.notes },
          { fields: ["status", "notes"] },
        ),
      },
    });
    return { ok: true, body: { ok: true, order: updated } };
  }

  return { ok: false, error: "Unknown action.", status: 400 };
}
