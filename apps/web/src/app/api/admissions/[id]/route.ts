import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { forbidUnless, patientName, requireHospitalActor } from "@/lib/front-desk";
import { notifyHospitalRole } from "@/lib/notifications";
import {
  WARD_ADMIT_ROLES,
  WARD_BILLING_ROLES,
  WARD_DISCHARGE_ADVICE_ROLES,
  WARD_TRANSFER_ROLES,
  WARD_VIEW_ROLES,
  admissionInclude,
  adviseDischarge,
  assertWardsModuleEnabled,
  cancelAdmission,
  dischargeAdmission,
  generateIpdInvoice,
  isDischargeType,
  transferAdmission,
  wardErrorResponse,
} from "@/lib/wards";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  const denied = forbidUnless(scoped.user.role, WARD_VIEW_ROLES);
  if (denied) return denied;

  try {
    await assertWardsModuleEnabled(scoped.user.hospitalId);
  } catch (error) {
    return wardErrorResponse(error);
  }

  const { id } = await context.params;
  const admission = await prisma.admission.findFirst({
    where: { id, hospitalId: scoped.user.hospitalId },
    include: admissionInclude,
  });
  if (!admission) return NextResponse.json({ error: "Admission not found." }, { status: 404 });
  return NextResponse.json({ admission });
}

export async function PATCH(request: Request, context: Ctx) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;

  try {
    await assertWardsModuleEnabled(scoped.user.hospitalId);
  } catch (error) {
    return wardErrorResponse(error);
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const action = String(body?.action ?? "");
  const hospital = scoped.user.hospital ?? (await prisma.hospital.findUnique({ where: { id: scoped.user.hospitalId } }));
  if (!hospital) return NextResponse.json({ error: "Hospital not found." }, { status: 400 });

  const admission = await prisma.admission.findFirst({
    where: { id, hospitalId: scoped.user.hospitalId },
    include: { patient: true, bed: { include: { ward: true } } },
  });
  if (!admission) return NextResponse.json({ error: "Admission not found." }, { status: 404 });

  try {
    if (action === "transfer") {
      const denied = forbidUnless(scoped.user.role, WARD_TRANSFER_ROLES);
      if (denied) return denied;
      await transferAdmission({
        hospitalId: scoped.user.hospitalId,
        admissionId: admission.id,
        toBedId: String(body?.toBedId ?? ""),
        reason: body?.reason != null ? String(body.reason) : null,
        transferredByUserId: scoped.user.id,
      });
      await writeAuditLog({
        request,
        hospitalId: scoped.user.hospitalId,
        actorUserId: scoped.user.id,
        actorUsername: scoped.user.username,
        actorRole: scoped.user.role,
        action: "ADMISSION_TRANSFERRED",
        entity: "Admission",
        entityId: admission.id,
        summary: `${scoped.user.username} transferred ${patientName(admission.patient)} (${admission.ipNumber}).`,
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "advise-discharge") {
      const denied = forbidUnless(scoped.user.role, WARD_DISCHARGE_ADVICE_ROLES);
      if (denied) return denied;
      await adviseDischarge({
        hospitalId: scoped.user.hospitalId,
        admissionId: admission.id,
        notes: body?.notes != null ? String(body.notes) : null,
      });
      await notifyHospitalRole({
        hospitalId: scoped.user.hospitalId,
        role: "RECEPTIONIST",
        href: `/wards/stays/${admission.id}`,
        title: "Discharge advised",
        body: `${patientName(admission.patient)} (${admission.ipNumber}) is ready for discharge billing.`,
      });
      await writeAuditLog({
        request,
        hospitalId: scoped.user.hospitalId,
        actorUserId: scoped.user.id,
        actorUsername: scoped.user.username,
        actorRole: scoped.user.role,
        action: "DISCHARGE_ADVISED",
        entity: "Admission",
        entityId: admission.id,
        summary: `${scoped.user.username} advised discharge for ${admission.ipNumber}.`,
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "discharge") {
      const denied = forbidUnless(scoped.user.role, WARD_ADMIT_ROLES);
      if (denied) return denied;
      const dischargeType = String(body?.dischargeType ?? "ROUTINE");
      if (!isDischargeType(dischargeType)) {
        return NextResponse.json({ error: "Invalid discharge type." }, { status: 400 });
      }
      const result = await dischargeAdmission({
        hospitalId: scoped.user.hospitalId,
        hospitalCode: hospital.code,
        admissionId: admission.id,
        dischargeType,
        notes: body?.notes != null ? String(body.notes) : null,
        applyAdvance: body?.applyAdvance !== false,
      });
      await writeAuditLog({
        request,
        hospitalId: scoped.user.hospitalId,
        actorUserId: scoped.user.id,
        actorUsername: scoped.user.username,
        actorRole: scoped.user.role,
        action: "PATIENT_DISCHARGED",
        entity: "Admission",
        entityId: admission.id,
        summary: `${scoped.user.username} discharged ${patientName(admission.patient)} (${admission.ipNumber}).`,
      });
      return NextResponse.json(result);
    }

    if (action === "invoice") {
      const denied = forbidUnless(scoped.user.role, WARD_BILLING_ROLES);
      if (denied) return denied;
      const invoice = await generateIpdInvoice({
        hospitalId: scoped.user.hospitalId,
        hospitalCode: hospital.code,
        admissionId: admission.id,
        applyAdvance: body?.applyAdvance !== false,
      });
      await writeAuditLog({
        request,
        hospitalId: scoped.user.hospitalId,
        actorUserId: scoped.user.id,
        actorUsername: scoped.user.username,
        actorRole: scoped.user.role,
        action: "IPD_INVOICE_ISSUED",
        entity: "Invoice",
        entityId: invoice.id,
        summary: `${scoped.user.username} issued IPD invoice ${invoice.invoiceNo} for ${admission.ipNumber}.`,
      });
      return NextResponse.json({ invoice });
    }

    if (action === "cancel") {
      const denied = forbidUnless(scoped.user.role, WARD_ADMIT_ROLES);
      if (denied) return denied;
      await cancelAdmission({ hospitalId: scoped.user.hospitalId, admissionId: admission.id });
      await writeAuditLog({
        request,
        hospitalId: scoped.user.hospitalId,
        actorUserId: scoped.user.id,
        actorUsername: scoped.user.username,
        actorRole: scoped.user.role,
        action: "ADMISSION_CANCELLED",
        entity: "Admission",
        entityId: admission.id,
        summary: `${scoped.user.username} cancelled admission ${admission.ipNumber}.`,
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown admission action." }, { status: 400 });
  } catch (error) {
    return wardErrorResponse(error);
  }
}
