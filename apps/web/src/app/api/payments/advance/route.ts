import { NextResponse } from "next/server";
import type { PaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { diffAuditFields, writeAuditLog } from "@/lib/audit";
import { BILLING_ROLES, forbidUnless, patientName, requireHospitalActor } from "@/lib/front-desk";

const METHODS: PaymentMethod[] = ["CASH", "CARD", "UPI", "INSURANCE"];

export async function POST(request: Request) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  const denied = forbidUnless(scoped.user.role, BILLING_ROLES);
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const patientId = String(body?.patientId ?? "");
  const method = String(body?.method ?? "") as PaymentMethod;
  const amount = Number(body?.amount ?? 0);
  const notes = String(body?.notes ?? "").trim() || "Advance for admission";
  const admissionId = String(body?.admissionId ?? "") || null;

  if (!METHODS.includes(method) || !(amount > 0)) {
    return NextResponse.json({ error: "Enter a valid method and amount." }, { status: 400 });
  }

  const patient = await prisma.patient.findFirst({
    where: { id: patientId, hospitalId: scoped.user.hospitalId, mergedIntoId: null },
  });
  if (!patient) {
    return NextResponse.json({ error: "Patient not found." }, { status: 404 });
  }

  if (admissionId) {
    const admission = await prisma.admission.findFirst({
      where: { id: admissionId, hospitalId: scoped.user.hospitalId, patientId: patient.id },
    });
    if (!admission) {
      return NextResponse.json({ error: "Admission not found for this patient." }, { status: 404 });
    }
  }

  await prisma.$transaction([
    prisma.payment.create({
      data: {
        hospitalId: scoped.user.hospitalId,
        patientId: patient.id,
        kind: "ADVANCE",
        method,
        amount,
        notes,
        admissionId,
        receivedByUserId: scoped.user.id,
      },
    }),
    prisma.patient.update({
      where: { id: patient.id },
      data: { advanceBalance: { increment: amount } },
    }),
  ]);

  await writeAuditLog({
    request,
    hospitalId: scoped.user.hospitalId,
    actorUserId: scoped.user.id,
    actorUsername: scoped.user.username,
    actorRole: scoped.user.role,
    action: "ADVANCE_COLLECTED",
    entity: "Patient",
    entityId: patient.id,
    summary: `${scoped.user.username} collected advance ${amount} (${method.toLowerCase()}) for ${patientName(patient)}.`,
    metadata: {
      changes: diffAuditFields(
        { advanceBalance: patient.advanceBalance },
        { advanceBalance: Number(patient.advanceBalance) + amount },
        { fields: ["advanceBalance"] },
      ),
    },
  });

  return NextResponse.json({ ok: true });
}
