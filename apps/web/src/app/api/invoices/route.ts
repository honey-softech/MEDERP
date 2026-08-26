import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import {
  BILLING_ROLES,
  doctorName,
  forbidUnless,
  invoiceStatusFromTotals,
  nextInvoiceNo,
  patientName,
  requireHospitalActor,
} from "@/lib/front-desk";

export async function GET(request: Request) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  const denied = forbidUnless(scoped.user.role, BILLING_ROLES);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";

  const invoices = await prisma.invoice.findMany({
    where: {
      hospitalId: scoped.user.hospitalId,
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

  const body = await request.json().catch(() => null);
  const patientId = String(body?.patientId ?? "");
  const appointmentId = String(body?.appointmentId ?? "") || null;
  const discountAmount = Math.max(0, Number(body?.discountAmount ?? 0));
  const description = String(body?.description ?? "").trim();

  const patient = await prisma.patient.findFirst({
    where: { id: patientId, hospitalId: scoped.user.hospitalId, mergedIntoId: null },
  });
  if (!patient) {
    return NextResponse.json({ error: "Patient not found." }, { status: 404 });
  }

  let items: { description: string; amount: number }[] = Array.isArray(body?.items)
    ? body.items.map((item: { description?: string; amount?: number }) => ({
        description: String(item.description ?? "").trim(),
        amount: Number(item.amount ?? 0),
      }))
    : [];

  if (appointmentId) {
    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, hospitalId: scoped.user.hospitalId, patientId: patient.id },
      include: { doctor: { include: { appUser: { select: { username: true } } } }, department: true },
    });
    if (!appointment) {
      return NextResponse.json({ error: "Appointment not found for this patient." }, { status: 404 });
    }
    const fee = Number(appointment.doctor.consultationFee ?? appointment.department.consultationFee);
    items = [
      {
        description:
          description ||
          `Consultation — ${appointment.department.name} with ${doctorName(appointment.doctor)}`,
        amount: fee,
      },
    ];
  }

  items = items.filter((item) => item.description && item.amount > 0);
  if (items.length === 0) {
    return NextResponse.json({ error: "Add at least one billable item." }, { status: 400 });
  }

  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  if (discountAmount > subtotal) {
    return NextResponse.json({ error: "Discount cannot exceed the subtotal." }, { status: 400 });
  }
  const netTotal = subtotal - discountAmount;
  const hospital = scoped.user.hospital ?? (await prisma.hospital.findUnique({ where: { id: scoped.user.hospitalId } }));
  if (!hospital) {
    return NextResponse.json({ error: "Hospital not found." }, { status: 400 });
  }

  const invoice = await prisma.invoice.create({
    data: {
      hospitalId: scoped.user.hospitalId,
      invoiceNo: await nextInvoiceNo(scoped.user.hospitalId, hospital.code),
      patientId: patient.id,
      appointmentId,
      status: invoiceStatusFromTotals(netTotal, 0),
      subtotal,
      discountAmount,
      netTotal,
      items: { create: items },
    },
    include: { patient: true, items: true },
  });

  await writeAuditLog({
    request,
    hospitalId: scoped.user.hospitalId,
    actorUserId: scoped.user.id,
    actorUsername: scoped.user.username,
    actorRole: scoped.user.role,
    action: "INVOICE_CREATED",
    entity: "Invoice",
    entityId: invoice.id,
    summary: `${scoped.user.username} issued ${invoice.invoiceNo} for ${patientName(patient)}.`,
  });

  return NextResponse.json({ ok: true, invoice });
}
