import { NextResponse } from "next/server";
import { CLINICAL_VIEW_ROLES, requireHospitalActor } from "@/lib/authz/hospital";
import { patientActionResponse } from "@/lib/patients/http";
import { updatePatient } from "@/lib/patients/update";
import { prisma } from "@/lib/prisma";
import { hospitalScope } from "@/lib/tenancy";
import { parseJsonBody } from "@/lib/validation/parse";
import { updatePatientSchema } from "@/lib/validation/patient";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  const canView =
    CLINICAL_VIEW_ROLES.includes(scoped.user.role) || scoped.user.role === "ACCOUNTANT";
  if (!canView) {
    return NextResponse.json({ error: "You do not have access to this action." }, { status: 403 });
  }

  const { id } = await context.params;
  const patient = await prisma.patient.findFirst({
    where: { id, ...hospitalScope(scoped.user.hospitalId) },
    include: {
      familyAsPrimary: { include: { relatedPatient: true } },
      familyAsRelated: { include: { primaryPatient: true } },
      mergedFrom: { select: { id: true, mrn: true, firstName: true, lastName: true } },
    },
  });
  if (!patient) {
    return NextResponse.json({ error: "Patient not found." }, { status: 404 });
  }
  return NextResponse.json({ patient });
}

export async function PATCH(request: Request, context: Ctx) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;

  const { id } = await context.params;
  const parsed = await parseJsonBody(request, updatePatientSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const result = await updatePatient({
      request,
      user: scoped.user,
      patientId: id,
      body: parsed.data,
    });
    return patientActionResponse(result);
  } catch (error) {
    console.error("Failed to update patient", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save patient." },
      { status: 500 },
    );
  }
}
