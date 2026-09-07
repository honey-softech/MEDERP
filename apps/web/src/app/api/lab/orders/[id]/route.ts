import { NextResponse } from "next/server";
import { LAB_VIEW_ROLES, LAB_WORK_ROLES, forbidUnless, requireHospitalActor } from "@/lib/front-desk";
import { labActionResponse } from "@/lib/lab-orders/http";
import { runLabOrderPatch } from "@/lib/lab-orders/patch";
import { prisma } from "@/lib/prisma";
import { hospitalScope } from "@/lib/tenancy";
import { labOrderPatchSchema } from "@/lib/validation/lab";
import { parseJsonBody } from "@/lib/validation/parse";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  const denied = forbidUnless(scoped.user.role, LAB_VIEW_ROLES);
  if (denied) return denied;
  const { id } = await context.params;
  const order = await prisma.labOrder.findFirst({
    where: { id, ...hospitalScope(scoped.user.hospitalId) },
    include: {
      patient: true,
      items: { include: { test: { select: { code: true } } } },
      appointment: { select: { id: true, tokenNumber: true } },
    },
  });
  if (!order) {
    return NextResponse.json({ error: "Lab order not found." }, { status: 404 });
  }
  return NextResponse.json({ order });
}

export async function PATCH(request: Request, context: Ctx) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  const denied = forbidUnless(scoped.user.role, LAB_WORK_ROLES);
  if (denied) return denied;

  const parsed = await parseJsonBody(request, labOrderPatchSchema);
  if (!parsed.ok) return parsed.response;

  const { id } = await context.params;
  const result = await runLabOrderPatch({
    request,
    user: scoped.user,
    orderId: id,
    action: parsed.data.action,
    notes: parsed.data.notes,
  });
  return labActionResponse(result);
}
