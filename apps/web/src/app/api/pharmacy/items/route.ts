import { NextRequest, NextResponse } from "next/server";
import { forbidUnless, requireHospitalActor } from "@/lib/front-desk";
import { findPharmacyItemByBarcode, listPharmacyInventory, PHARMACY_ROLES, searchPharmacyOrCatalog } from "@/lib/pharmacy";

export async function GET(request: NextRequest) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  const denied = forbidUnless(scoped.user.role, PHARMACY_ROLES);
  if (denied) return denied;

  const barcode = request.nextUrl.searchParams.get("barcode")?.trim() ?? "";
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (barcode) {
    const item = await findPharmacyItemByBarcode(scoped.user.hospitalId, barcode);
    return NextResponse.json({ item });
  }

  if (q) {
    const result = await searchPharmacyOrCatalog(scoped.user.hospitalId, q);
    return NextResponse.json(result);
  }

  const inventory = await listPharmacyInventory(scoped.user.hospitalId);
  return NextResponse.json({ inventory });
}
