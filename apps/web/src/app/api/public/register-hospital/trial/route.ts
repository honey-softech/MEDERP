import { NextResponse } from "next/server";
import { createSession, homeForRole } from "@/lib/auth";
import { HospitalRegistrationError, prepareHospitalRegistration, registerHospital } from "@/lib/hospital-registration";
import { trialEndsAtFromNow } from "@/lib/hospital-access";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!body.termsAccepted) {
    return NextResponse.json({ error: "Accept the Terms & Conditions to start the trial." }, { status: 400 });
  }

  try {
    const prepared = await prepareHospitalRegistration({
      name: String(body.name ?? ""),
      code: String(body.code ?? ""),
      address: body.address != null ? String(body.address) : null,
      phone: body.phone != null ? String(body.phone) : null,
      adminUsername: String(body.adminUsername ?? ""),
      adminMobile: String(body.adminMobile ?? ""),
      adminEmail: body.adminEmail != null ? String(body.adminEmail) : null,
      adminPassword: String(body.adminPassword ?? ""),
      tierId: body.tierId != null ? String(body.tierId) : undefined,
      termsAccepted: true,
    });

    const result = await registerHospital({
      name: prepared.name,
      code: prepared.code,
      address: prepared.address,
      phone: prepared.phone,
      adminUsername: prepared.adminUsername,
      adminMobile: prepared.adminMobile,
      adminEmail: prepared.adminEmail,
      adminPassword: prepared.adminPassword,
      tierId: prepared.tierId,
      invoiceStatus: "ISSUED",
      paymentNotes: "1-month free trial — pay before the trial ends to keep using MedERP.",
      termsAccepted: true,
      trialEndsAt: trialEndsAtFromNow(),
      actor: {
        username: prepared.adminUsername,
        role: "SUPER_ADMIN",
      },
      request,
    });

    if (result.superAdmin) {
      await createSession(result.superAdmin.id);
    }

    return NextResponse.json({
      ok: true,
      trial: true,
      hospital: { id: result.hospital.id, name: result.hospital.name, code: result.hospital.code },
      invoice: {
        id: result.invoice.id,
        invoiceNo: result.invoice.invoiceNo,
        total: result.quote.total,
        status: result.invoice.status,
      },
      redirectTo: homeForRole("SUPER_ADMIN", result.hospital.id),
    });
  } catch (error) {
    if (error instanceof HospitalRegistrationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Hospital trial registration failed", error);
    return NextResponse.json({ error: "Could not start the free trial." }, { status: 500 });
  }
}
