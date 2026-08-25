import { NextResponse } from "next/server";
import type { FamilyRelation } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { FRONT_DESK_ROLES, forbidUnless, requireHospitalActor } from "@/lib/front-desk";

const RELATIONS: FamilyRelation[] = ["SPOUSE", "CHILD", "PARENT", "SIBLING", "OTHER"];

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  const denied = forbidUnless(scoped.user.role, FRONT_DESK_ROLES);
  if (denied) return denied;

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const relatedPatientId = String(body?.relatedPatientId ?? "");
  const relation = String(body?.relation ?? "") as FamilyRelation;

  if (!RELATIONS.includes(relation)) {
    return NextResponse.json({ error: "Select a valid family relation." }, { status: 400 });
  }
  if (!relatedPatientId || relatedPatientId === id) {
    return NextResponse.json({ error: "Select a different family member." }, { status: 400 });
  }

  const [primary, related] = await Promise.all([
    prisma.patient.findFirst({ where: { id, hospitalId: scoped.user.hospitalId, mergedIntoId: null } }),
    prisma.patient.findFirst({
      where: { id: relatedPatientId, hospitalId: scoped.user.hospitalId, mergedIntoId: null },
    }),
  ]);
  if (!primary || !related) {
    return NextResponse.json({ error: "Patient not found in this hospital." }, { status: 404 });
  }

  const link = await prisma.patientFamily.upsert({
    where: {
      primaryPatientId_relatedPatientId: { primaryPatientId: id, relatedPatientId },
    },
    update: { relation },
    create: {
      hospitalId: scoped.user.hospitalId,
      primaryPatientId: id,
      relatedPatientId,
      relation,
    },
  });

  await writeAuditLog({
    request,
    hospitalId: scoped.user.hospitalId,
    actorUserId: scoped.user.id,
    actorUsername: scoped.user.username,
    actorRole: scoped.user.role,
    action: "PATIENT_FAMILY_LINKED",
    entity: "Patient",
    entityId: id,
    summary: `${scoped.user.username} linked ${related.firstName} ${related.lastName} as ${relation.toLowerCase()} of ${primary.firstName} ${primary.lastName}.`,
  });

  return NextResponse.json({ ok: true, link });
}
