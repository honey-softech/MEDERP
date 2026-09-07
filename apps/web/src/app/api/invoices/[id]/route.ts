import { NextResponse } from "next/server";
import { BILLING_ROLES, forbidUnless, requireHospitalActor } from "@/lib/authz/hospital";
import { billingActionResponse } from "@/lib/billing/http";
import { runInvoicePatch } from "@/lib/billing/patch";
import { prisma } from "@/lib/prisma";
import { hospitalScope } from "@/lib/tenancy";
import { invoicePatchSchema } from "@/lib/validation/invoice";
import { parseJsonBody } from "@/lib/validation/parse";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  const denied = forbidUnless(scoped.user.role, BILLING_ROLES);
  if (denied) return denied;
  const { id } = await context.params;
  const invoice = await prisma.invoice.findFirst({
    where: { id, ...hospitalScope(scoped.user.hospitalId) },
    include: {
      patient: true,
      items: true,
      payments: true,
      appointment: { include: { doctor: { include: { appUser: { select: { username: true } } } }, department: true } },
    },
  });
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }
  return NextResponse.json({ invoice });
}

export async function PATCH(request: Request, context: Ctx) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;

  const { id } = await context.params;
  const invoice = await prisma.invoice.findFirst({
    where: { id, ...hospitalScope(scoped.user.hospitalId) },
    include: { patient: true },
  });
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }

  const parsed = await parseJsonBody(request, invoicePatchSchema);
  if (!parsed.ok) return parsed.response;

  const result = await runInvoicePatch({
    request,
    user: scoped.user,
    invoice,
    body: parsed.data,
  });
  return billingActionResponse(result);
}
