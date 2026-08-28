import type { AppRole, PaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { invoiceStatusFromTotals, nextInvoiceNo, patientName } from "@/lib/front-desk";
import { notifyHospitalRole } from "@/lib/notifications";
import { parseMedications } from "@/lib/prescription-text";
import { activeSignatureFor } from "@/lib/signatures";

export const PHARMACY_BILLING_ROLES: AppRole[] = ["SUPER_ADMIN", "RECEPTIONIST", "PHARMACIST"];

/** Estimate pack qty from dose notes like "1-0-1 for 5 days". */
export function estimateQuantity(doseNotes?: string | null) {
  if (!doseNotes) return 1;
  const text = doseNotes.toLowerCase();
  const daysMatch = text.match(/for\s+(\d+)\s*day/);
  const days = daysMatch ? Number(daysMatch[1]) : 1;
  const pattern = text.match(/(\d)\s*[-–]\s*(\d)\s*[-–]\s*(\d)/);
  if (pattern) {
    const doses = Number(pattern[1]) + Number(pattern[2]) + Number(pattern[3]);
    return Math.max(1, doses * Math.max(1, days));
  }
  if (/\bod\b/.test(text) || /\b1\s*daily\b/.test(text)) return Math.max(1, days);
  if (/\bbd\b/.test(text)) return Math.max(1, days * 2);
  if (/\btds\b/.test(text)) return Math.max(1, days * 3);
  return Math.max(1, days);
}

async function matchPharmacyItem(hospitalId: string, medicineName: string) {
  const name = medicineName.trim();
  if (!name) return null;
  const exact = await prisma.pharmacyItem.findFirst({
    where: { hospitalId, isActive: true, name: { equals: name, mode: "insensitive" } },
  });
  if (exact) return exact;
  return prisma.pharmacyItem.findFirst({
    where: { hospitalId, isActive: true, name: { contains: name.split(/\s+/)[0] ?? name, mode: "insensitive" } },
    orderBy: { name: "asc" },
  });
}

/** FEFO: earliest expiry with enough stock; may split across batches later — MVP single batch. */
export async function pickFefoBatch(itemId: string, quantity: number) {
  const now = new Date();
  return prisma.pharmacyBatch.findFirst({
    where: {
      itemId,
      quantityAvailable: { gte: quantity },
      expiryDate: { gte: now },
    },
    orderBy: { expiryDate: "asc" },
  });
}

const pharmacyRxInclude = {
  lines: { include: { pharmacyItem: true, batch: true } },
  patient: true,
  appointment: { include: { doctor: { include: { appUser: { select: { username: true } } } } } },
  invoice: true,
} as const;

export async function refreshRxLinePricing(orderId: string) {
  const order = await prisma.pharmacyRxOrder.findUnique({
    where: { id: orderId },
    include: { lines: true },
  });
  if (!order || order.status !== "AWAITING_PAYMENT") {
    return prisma.pharmacyRxOrder.findUnique({
      where: { id: orderId },
      include: pharmacyRxInclude,
    });
  }

  let total = 0;
  for (const line of order.lines) {
    let itemId = line.pharmacyItemId;
    if (!itemId) {
      const matched = await matchPharmacyItem(order.hospitalId, line.medicineName);
      itemId = matched?.id ?? null;
    }
    const batch = itemId ? await pickFefoBatch(itemId, line.quantity) : null;
    const unitPrice = batch ? Number(batch.mrp) : 0;
    const lineTotal = batch ? unitPrice * line.quantity : 0;
    total += lineTotal;
    await prisma.pharmacyRxLine.update({
      where: { id: line.id },
      data: {
        pharmacyItemId: itemId,
        batchId: batch?.id ?? null,
        unitPrice,
        lineTotal,
        inStock: Boolean(batch),
      },
    });
  }

  return prisma.pharmacyRxOrder.update({
    where: { id: orderId },
    data: { totalAmount: total },
    include: pharmacyRxInclude,
  });
}

export async function syncPharmacyRxFromAssessment(params: {
  hospitalId: string;
  appointmentId: string;
  patientId: string;
  prescription: string | null;
  orderedByUsername: string;
}) {
  const meds = parseMedications(params.prescription);
  if (meds.length === 0) {
    await prisma.pharmacyRxOrder.updateMany({
      where: { appointmentId: params.appointmentId, status: "AWAITING_PAYMENT" },
      data: { status: "CANCELLED" },
    });
    return null;
  }

  const existing = await prisma.pharmacyRxOrder.findUnique({
    where: { appointmentId: params.appointmentId },
  });

  if (existing?.status === "DISPENSED") {
    return existing;
  }

  if (existing) {
    await prisma.pharmacyRxLine.deleteMany({ where: { orderId: existing.id } });
    await prisma.pharmacyRxOrder.update({
      where: { id: existing.id },
      data: {
        status: "AWAITING_PAYMENT",
        orderedByUsername: params.orderedByUsername,
        totalAmount: 0,
        invoiceId: null,
        paidAt: null,
        dispensedAt: null,
      },
    });
    for (const med of meds) {
      await prisma.pharmacyRxLine.create({
        data: {
          orderId: existing.id,
          medicineName: med.name,
          doseNotes: med.notes || null,
          quantity: estimateQuantity(med.notes),
        },
      });
    }
    const refreshed = await refreshRxLinePricing(existing.id);
    await notifyPharmacyQueue(params.hospitalId, params.appointmentId, params.patientId);
    return refreshed;
  }

  const order = await prisma.pharmacyRxOrder.create({
    data: {
      hospitalId: params.hospitalId,
      appointmentId: params.appointmentId,
      patientId: params.patientId,
      orderedByUsername: params.orderedByUsername,
      lines: {
        create: meds.map((med) => ({
          medicineName: med.name,
          doseNotes: med.notes || null,
          quantity: estimateQuantity(med.notes),
        })),
      },
    },
  });

  const refreshed = await refreshRxLinePricing(order.id);
  await notifyPharmacyQueue(params.hospitalId, params.appointmentId, params.patientId);
  return refreshed;
}

async function notifyPharmacyQueue(hospitalId: string, appointmentId: string, patientId: string) {
  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  const label = patient ? patientName(patient) : "patient";
  const href = `/pharmacy/prescriptions/${appointmentId}`;
  const title = "Pharmacy bill pending";
  const body = `Prescription ready for billing/dispense — ${label}.`;
  await notifyHospitalRole({ hospitalId, role: "RECEPTIONIST", appointmentId, title, body, href });
  await notifyHospitalRole({ hospitalId, role: "PHARMACIST", appointmentId, title, body, href });
  await notifyHospitalRole({ hospitalId, role: "SUPER_ADMIN", appointmentId, title, body, href });
}

export async function listPendingPharmacyRx(hospitalId: string) {
  const orders = await prisma.pharmacyRxOrder.findMany({
    where: { hospitalId, status: "AWAITING_PAYMENT" },
    include: {
      patient: true,
      appointment: {
        include: { doctor: { include: { appUser: { select: { username: true } } } } },
      },
      lines: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return orders.map((order) => ({
    id: order.id,
    appointmentId: order.appointmentId,
    patient: patientName(order.patient),
    mrn: order.patient.mrn,
    doctor: order.appointment.doctor.appUser?.username ?? order.appointment.doctor.firstName,
    lines: order.lines.length,
    inStockLines: order.lines.filter((line) => line.inStock).length,
    totalAmount: Number(order.totalAmount),
    createdAt: order.createdAt,
  }));
}

export async function getPharmacyRxForAppointment(hospitalId: string, appointmentId: string) {
  const order = await prisma.pharmacyRxOrder.findFirst({
    where: { hospitalId, appointmentId },
    include: pharmacyRxInclude,
  });
  if (!order) return null;
  if (order.status === "AWAITING_PAYMENT") {
    return refreshRxLinePricing(order.id);
  }
  return order;
}

export async function updateRxLineQuantities(
  orderId: string,
  hospitalId: string,
  updates: Array<{ lineId: string; quantity: number }>,
) {
  const order = await prisma.pharmacyRxOrder.findFirst({
    where: { id: orderId, hospitalId, status: "AWAITING_PAYMENT" },
  });
  if (!order) throw new Error("Order not found or already dispensed.");

  for (const update of updates) {
    const qty = Math.trunc(Number(update.quantity));
    if (!Number.isFinite(qty) || qty < 1) throw new Error("Quantity must be at least 1.");
    await prisma.pharmacyRxLine.updateMany({
      where: { id: update.lineId, orderId },
      data: { quantity: qty },
    });
  }
  return refreshRxLinePricing(orderId);
}

export async function collectAndDispenseRx(params: {
  orderId: string;
  hospitalId: string;
  hospitalCode: string;
  actorUserId: string;
  actorUsername: string;
  method: PaymentMethod;
  notes?: string | null;
}) {
  const order = await refreshRxLinePricing(params.orderId);
  if (!order || order.hospitalId !== params.hospitalId) {
    throw new Error("Prescription order not found.");
  }
  if (order.status !== "AWAITING_PAYMENT") {
    throw new Error("This prescription was already billed/dispensed.");
  }

  const lines = order.lines;
  if (lines.length === 0) throw new Error("No medicines on this order.");
  const missing = lines.filter((line) => !line.inStock || !line.batchId || !line.pharmacyItemId);
  if (missing.length > 0) {
    throw new Error(
      `Out of stock: ${missing.map((line) => line.medicineName).join(", ")}. Receive stock (GRN) first or adjust quantities.`,
    );
  }

  const total = lines.reduce((sum, line) => sum + Number(line.lineTotal), 0);
  if (total <= 0) throw new Error("Bill total must be greater than zero.");

  const signature = await activeSignatureFor(params.actorUserId, params.hospitalId);

  return prisma.$transaction(async (tx) => {
    for (const line of lines) {
      const batch = await tx.pharmacyBatch.findUnique({ where: { id: line.batchId! } });
      if (!batch || batch.quantityAvailable < line.quantity) {
        throw new Error(`Insufficient stock for ${line.medicineName} (batch changed). Refresh and retry.`);
      }
      const updated = await tx.pharmacyBatch.update({
        where: { id: batch.id },
        data: { quantityAvailable: { decrement: line.quantity } },
      });
      await tx.pharmacyLedger.create({
        data: {
          hospitalId: params.hospitalId,
          itemId: line.pharmacyItemId!,
          batchId: batch.id,
          kind: "SALE_OUT",
          quantityDelta: -line.quantity,
          quantityAfter: updated.quantityAvailable,
          reason: "Prescription dispense",
          refType: "PharmacyRxOrder",
          refId: order.id,
          actorUserId: params.actorUserId,
          actorUsername: params.actorUsername,
        },
      });
    }

    const invoiceNo = await nextInvoiceNo(params.hospitalId, params.hospitalCode);
    const invoice = await tx.invoice.create({
      data: {
        hospitalId: params.hospitalId,
        invoiceNo,
        patientId: order.patientId,
        appointmentId: order.appointmentId,
        status: "PAID",
        subtotal: total,
        netTotal: total,
        paidAmount: total,
        items: {
          create: lines.map((line) => ({
            description: `Pharmacy · ${line.medicineName} × ${line.quantity}${line.batch ? ` (batch ${line.batch.batchNo})` : ""}`,
            amount: line.lineTotal,
          })),
        },
      },
    });

    await tx.payment.create({
      data: {
        hospitalId: params.hospitalId,
        patientId: order.patientId,
        invoiceId: invoice.id,
        kind: "COLLECTION",
        method: params.method,
        amount: total,
        notes: params.notes?.trim() || "Pharmacy prescription collection",
        receivedByUserId: params.actorUserId,
        receivedBySignatureId: signature?.id ?? null,
      },
    });

    const dispensed = await tx.pharmacyRxOrder.update({
      where: { id: order.id },
      data: {
        status: "DISPENSED",
        invoiceId: invoice.id,
        totalAmount: total,
        paidAt: new Date(),
        dispensedAt: new Date(),
        dispensedByUserId: params.actorUserId,
        dispensedByUsername: params.actorUsername,
      },
      include: { invoice: true, patient: true, lines: true },
    });

    // Ensure invoice status stays consistent with paid amount helpers
    const status = invoiceStatusFromTotals(total, total);
    if (status !== "PAID") {
      await tx.invoice.update({ where: { id: invoice.id }, data: { status } });
    }

    return dispensed;
  });
}
