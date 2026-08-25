import { NextResponse } from "next/server";
import type { PaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { HospitalRegistrationError, registerHospital } from "@/lib/hospital-registration";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "SOFTWARE_ADMIN") {
    return NextResponse.json({ error: "Software admin access required." }, { status: 403 });
  }

  const hospitals = await prisma.hospital.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { users: true, platformInvoices: true } },
      users: {
        where: { role: "SUPER_ADMIN" },
        select: { username: true, mobile: true },
      },
    },
  });

  return NextResponse.json({ hospitals });
}

export async function POST(request: Request) {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== "SOFTWARE_ADMIN") {
    return NextResponse.json({ error: "Software admin access required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const paymentMethod = "UPI" as PaymentMethod;

  try {
    const result = await registerHospital({
      name: String(body?.name ?? ""),
      code: String(body?.code ?? ""),
      address: body?.address != null ? String(body.address) : null,
      phone: body?.phone != null ? String(body.phone) : null,
      adminUsername: String(body?.adminUsername ?? ""),
      adminMobile: String(body?.adminMobile ?? ""),
      adminPassword: String(body?.adminPassword ?? ""),
      tierId: body?.tierId != null ? String(body.tierId) : undefined,
      extraStaffSlots: Number(body?.extraStaffSlots ?? 0),
      pharmacyEnabled: Boolean(body?.pharmacyEnabled),
      labEnabled: Boolean(body?.labEnabled),
      invoiceStatus: "PAID",
      paymentMethod,
      paymentNotes: String(body?.paymentNotes ?? "").trim() || null,
      actor: { userId: actor.id, username: actor.username, role: actor.role },
      request,
    });
    return NextResponse.json({ ok: true, hospital: result.hospital, invoice: result.invoice });
  } catch (error) {
    if (error instanceof HospitalRegistrationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Failed to register hospital", error);
    return NextResponse.json({ error: "Could not register hospital." }, { status: 500 });
  }
}
