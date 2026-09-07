import { NextResponse } from "next/server";
import { BILLING_ROLES, forbidUnless, requireHospitalActor } from "@/lib/authz/hospital";
import { createInvoice } from "@/lib/billing/create";
import { billingActionResponse } from "@/lib/billing/http";
import { prisma } from "@/lib/prisma";
import { hospitalScope } from "@/lib/tenancy";
import { createInvoiceSchema } from "@/lib/validation/invoice";
import { parseJsonBody } from "@/lib/validation/parse";

export async function GET(request: Request) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  const denied = forbidUnless(scoped.user.role, BILLING_ROLES);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";

  const invoices = await prisma.invoice.findMany({
    where: {
      ...hospitalScope(scoped.user.hospitalId),
      ...(q
        ? {
            OR: [
              { invoiceNo: { contains: q, mode: "insensitive" } },
              { patient: { firstName: { contains: q, mode: "insensitive" } } },
              { patient: { lastName: { contains: q, mode: "insensitive" } } },
              { patient: { mrn: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: { patient: true, items: true, payments: true },
    orderBy: { issuedAt: "desc" },
    take: 80,
  });

  return NextResponse.json({ invoices });
}

export async function POST(request: Request) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  const denied = forbidUnless(scoped.user.role, BILLING_ROLES);
  if (denied) return denied;

  const parsed = await parseJsonBody(request, createInvoiceSchema);
  if (!parsed.ok) return parsed.response;

  const result = await createInvoice({
    request,
    user: scoped.user,
    patientId: parsed.data.patientId,
    appointmentId: parsed.data.appointmentId,
    discountAmount: parsed.data.discountAmount,
    description: parsed.data.description,
    items: parsed.data.items,
  });
  return billingActionResponse(result);
}
