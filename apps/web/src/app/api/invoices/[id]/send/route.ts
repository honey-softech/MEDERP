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
  try {
    const result = await sendInvoiceWhatsApp({
      request,
      user: scoped.user,
      invoiceId: id,
    });
    return billingActionResponse(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not send the bill.";
    console.error("[billing-send]", error);
    if (/wrong final block length|OSSL|SSL|TLS/i.test(message)) {
      return billingActionResponse({
        ok: false,
        error: "Could not reach AskEva from the live server (network/TLS).",
        status: 502,
      });
    }
    return billingActionResponse({ ok: false, error: message.slice(0, 300), status: 502 });
  }
}
