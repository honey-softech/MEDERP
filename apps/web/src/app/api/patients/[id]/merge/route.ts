import { FRONT_DESK_ROLES, forbidUnless, requireHospitalActor } from "@/lib/front-desk";
import { patientActionResponse } from "@/lib/patients/http";
import { mergePatients } from "@/lib/patients/merge";
import { parseJsonBody } from "@/lib/validation/parse";
import { mergePatientSchema } from "@/lib/validation/patient";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  const denied = forbidUnless(scoped.user.role, FRONT_DESK_ROLES);
  if (denied) return denied;

  const { id } = await context.params;
  const parsed = await parseJsonBody(request, mergePatientSchema);
  if (!parsed.ok) return parsed.response;

  const result = await mergePatients({
    request,
    user: scoped.user,
    survivorId: id,
    duplicateId: parsed.data.duplicateId,
  });
  return patientActionResponse(result);
}
