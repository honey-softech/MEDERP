import { writeAuditLog } from "@/lib/audit";
import type { HospitalActor } from "@/lib/authz/hospital";
import { parseBillItems } from "@/lib/billing/rules";
import type { BillingActionResult } from "@/lib/billing/types";
import { doctorName, patientName } from "@/lib/display";
import { nextInvoiceNo } from "@/lib/ids";
import { invoiceStatusFromTotals } from "@/lib/opd/fees";
import { prisma } from "@/lib/prisma";
import { hospitalScope } from "@/lib/tenancy";

export async function createInvoice(params: {
  request: Request;
  user: HospitalActor;
  patientId: string;
  appointmentId: string | null;
  discountAmount: number;
  description: string;
  items: unknown;
}): Promise<BillingActionResult> {
  const scope = hospitalScope(params.user.hospitalId);
  const patient = await prisma.patient.findFirst({
    where: { id: params.patientId, ...scope, mergedIntoId: null },
  });
  if (!patient) {
    return { ok: false, error: "Patient not found.", status: 404 };
  }

  let items = parseBillItems(params.items);
  if (params.appointmentId) {
    const appointment = await prisma.appointment.findFirst({
      where: { id: params.appointmentId, ...scope, patientId: patient.id },
      include: { doctor: { include: { appUser: { select: { username: true } } } }, department: true },
    });
    if (!appointment) {
      return { ok: false, error: "Appointment not found for this patient.", status: 404 };
    }
    const fee = Number(appointment.doctor.consultationFee ?? appointment.department.consultationFee);
    items = [
      {
        description:
          params.description ||
          `Consultation — ${appointment.department.name} with ${doctorName(appointment.doctor)}`,
        amount: fee,
      },
    ];
  }

  items = items.filter((item) => item.description && item.amount > 0);
  if (items.length === 0) {
    return { ok: false, error: "Add at least one billable item.", status: 400 };
  }

  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  if (params.discountAmount > subtotal) {
    return { ok: false, error: "Discount cannot exceed the subtotal.", status: 400 };
  }
  const netTotal = subtotal - params.discountAmount;
  const hospital = params.user.hospital ?? (await prisma.hospital.findUnique({ where: { id: params.user.hospitalId } }));
  if (!hospital) {
    return { ok: false, error: "Hospital not found.", status: 400 };
  }

  const invoice = await prisma.invoice.create({
    data: {
      hospitalId: params.user.hospitalId,
      invoiceNo: await nextInvoiceNo(params.user.hospitalId, hospital.code),
      patientId: patient.id,
      appointmentId: params.appointmentId,
      status: invoiceStatusFromTotals(netTotal, 0),
      subtotal,
      discountAmount: params.discountAmount,
      netTotal,
      items: { create: items },
    },
    include: { patient: true, items: true },
  });

  await writeAuditLog({
    request: params.request,
    hospitalId: params.user.hospitalId,
    actorUserId: params.user.id,
    actorUsername: params.user.username,
    actorRole: params.user.role,
    action: "INVOICE_CREATED",
    entity: "Invoice",
    entityId: invoice.id,
    summary: `${params.user.username} issued ${invoice.invoiceNo} for ${patientName(patient)}.`,
  });

  return { ok: true, body: { ok: true, invoice } };
}
