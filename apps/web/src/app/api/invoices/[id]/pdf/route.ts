import { NextResponse } from "next/server";
import { loadInvoiceReceiptPdf } from "@/lib/billing/receipt-pdf";
import { BILLING_ROLES, forbidUnless, requireHospitalActor } from "@/lib/front-desk";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  const denied = forbidUnless(scoped.user, BILLING_ROLES);
  if (denied) return denied;

  const { id } = await context.params;
  const result = await loadInvoiceReceiptPdf({
    hospitalId: scoped.user.hospitalId,
    invoiceId: id,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return new NextResponse(new Uint8Array(result.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(result.pdf.length),
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
