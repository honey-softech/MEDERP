import { FRONT_DESK_ROLES, forbidUnless, requireHospitalActor } from "@/lib/front-desk";
import { linkFamilyMember } from "@/lib/patients/family";
import { patientActionResponse } from "@/lib/patients/http";
import { parseJsonBody } from "@/lib/validation/parse";
import { linkFamilySchema } from "@/lib/validation/patient";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  const denied = forbidUnless(scoped.user.role, FRONT_DESK_ROLES);
  if (denied) return denied;

  const { id } = await context.params;
  const parsed = await parseJsonBody(request, linkFamilySchema);
  if (!parsed.ok) return parsed.response;

  const result = await linkFamilyMember({
    request,
    user: scoped.user,
    primaryId: id,
    relatedPatientId: parsed.data.relatedPatientId,
    relation: parsed.data.relation,
  });
  return patientActionResponse(result);
}
