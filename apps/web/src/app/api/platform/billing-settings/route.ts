import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPlatformBillingSettings, updatePlatformBillingSettings } from "@/lib/platform-billing";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "SOFTWARE_ADMIN") {
    return NextResponse.json({ error: "Software admin access required." }, { status: 403 });
  }

  const settings = await getPlatformBillingSettings();
  return NextResponse.json({ settings });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "SOFTWARE_ADMIN") {
    return NextResponse.json({ error: "Software admin access required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const settings = await updatePlatformBillingSettings({
    companyName: String(body.companyName ?? "").trim() || undefined,
    companyAddress: body.companyAddress != null ? String(body.companyAddress).trim() || null : undefined,
    companyPhone: body.companyPhone != null ? String(body.companyPhone).trim() || null : undefined,
    companyEmail: body.companyEmail != null ? String(body.companyEmail).trim() || null : undefined,
    gstin: body.gstin != null ? String(body.gstin).trim() || null : undefined,
    invoicePrefix: body.invoicePrefix != null ? String(body.invoicePrefix).trim().toUpperCase() || undefined : undefined,
    bankDetails: body.bankDetails != null ? String(body.bankDetails).trim() || null : undefined,
    termsNote: body.termsNote != null ? String(body.termsNote).trim() || null : undefined,
    basePackageFee: body.basePackageFee != null ? Number(body.basePackageFee) : undefined,
    includedStaffSlots: body.includedStaffSlots != null ? Math.max(1, Math.trunc(Number(body.includedStaffSlots))) : undefined,
    extraUserFee: body.extraUserFee != null ? Number(body.extraUserFee) : undefined,
    pharmacyModuleFee: body.pharmacyModuleFee != null ? Number(body.pharmacyModuleFee) : undefined,
    labModuleFee: body.labModuleFee != null ? Number(body.labModuleFee) : undefined,
  });

  return NextResponse.json({ ok: true, settings });
}
