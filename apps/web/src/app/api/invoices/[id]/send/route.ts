import { BILLING_ROLES, forbidUnless, requireHospitalActor } from "@/lib/front-desk";
import { billingActionResponse } from "@/lib/billing/http";
import { sendInvoiceWhatsApp } from "@/lib/billing/send";
import { parseJsonBody } from "@/lib/validation/parse";
import { sendInvoiceSchema } from "@/lib/validation/invoice";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  const denied = forbidUnless(scoped.user.role, BILLING_ROLES);
  if (denied) return denied;

  const parsed = await parseJsonBody(request, sendInvoiceSchema);
  if (!parsed.ok) return parsed.response;

  const { id } = await context.params;
  const result = await sendInvoiceWhatsApp({
    request,
    user: scoped.user,
    invoiceId: id,
  });
  return billingActionResponse(result);
}
