import { NextRequest, NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit";
import { forbidUnless, requireHospitalActor } from "@/lib/front-desk";
import { PHARMACY_ROLES, receiveGrn, type GrnLineInput } from "@/lib/pharmacy";

export async function POST(request: NextRequest) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  const denied = forbidUnless(scoped.user.role, PHARMACY_ROLES);
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const linesRaw = Array.isArray(body?.lines) ? body.lines : [];
  const lines: GrnLineInput[] = linesRaw.map((line: Record<string, unknown>) => ({
    itemId: typeof line.itemId === "string" ? line.itemId : undefined,
    name: String(line.name ?? "").trim(),
    genericName: line.genericName != null ? String(line.genericName) : null,
    manufacturer: line.manufacturer != null ? String(line.manufacturer) : null,
    unit: line.unit != null ? String(line.unit) : "tablet",
    barcode: line.barcode != null ? String(line.barcode) : null,
    catalogDrugId: line.catalogDrugId != null ? String(line.catalogDrugId) : null,
    batchNo: String(line.batchNo ?? "").trim(),
    mfgDate: line.mfgDate != null ? String(line.mfgDate) : null,
    expiryDate: String(line.expiryDate ?? ""),
    quantity: Number(line.quantity),
    purchaseRate: Number(line.purchaseRate),
    mrp: Number(line.mrp),
    gstPercent: line.gstPercent != null ? Number(line.gstPercent) : 5,
  }));

  try {
    const grn = await receiveGrn({
      hospitalId: scoped.user.hospitalId,
      actorUserId: scoped.user.id,
      actorUsername: scoped.user.username,
      supplierName: body?.supplierName != null ? String(body.supplierName) : null,
      invoiceNo: body?.invoiceNo != null ? String(body.invoiceNo) : null,
      invoiceDate: body?.invoiceDate != null ? String(body.invoiceDate) : null,
      notes: body?.notes != null ? String(body.notes) : null,
      lines,
    });

    await writeAuditLog({
      request,
      hospitalId: scoped.user.hospitalId,
      actorUserId: scoped.user.id,
      actorUsername: scoped.user.username,
      actorRole: scoped.user.role,
      action: "PHARMACY_GRN_RECEIVED",
      entity: "PharmacyGrn",
      entityId: grn.id,
      summary: `${scoped.user.username} received pharmacy stock (${lines.length} line${lines.length === 1 ? "" : "s"}).`,
    });

    return NextResponse.json({ ok: true, grnId: grn.id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not receive stock." },
      { status: 400 },
    );
  }
}
