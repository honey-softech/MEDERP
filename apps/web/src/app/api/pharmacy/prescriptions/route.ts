import { NextResponse } from "next/server";
import { forbidUnless, requireHospitalActor } from "@/lib/front-desk";
import { listPendingPharmacyRx, PHARMACY_BILLING_ROLES } from "@/lib/pharmacy-rx";

export async function GET() {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  const denied = forbidUnless(scoped.user.role, PHARMACY_BILLING_ROLES);
  if (denied) return denied;

  const orders = await listPendingPharmacyRx(scoped.user.hospitalId);
  return NextResponse.json({ orders });
}
