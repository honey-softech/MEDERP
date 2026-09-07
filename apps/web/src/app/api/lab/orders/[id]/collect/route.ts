import { BILLING_ROLES, forbidUnless, requireHospitalActor } from "@/lib/front-desk";
import { collectLabOrderPayment } from "@/lib/lab-orders/collect";
import { labActionResponse } from "@/lib/lab-orders/http";
import { labCollectSchema } from "@/lib/validation/lab";
import { parseJsonBody } from "@/lib/validation/parse";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  const denied = forbidUnless(scoped.user.role, BILLING_ROLES);
  if (denied) return denied;

  const parsed = await parseJsonBody(request, labCollectSchema);
  if (!parsed.ok) return parsed.response;

  const { id } = await context.params;
  const result = await collectLabOrderPayment({
    request,
    user: scoped.user,
    orderId: id,
    method: parsed.data.method,
    amount: parsed.data.amount,
    cardBrand: parsed.data.cardBrand,
    cardLast4: parsed.data.cardLast4,
    referenceNo: parsed.data.referenceNo,
  });
  return labActionResponse(result);
}
