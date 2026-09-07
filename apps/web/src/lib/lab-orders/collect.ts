import { diffAuditFields, writeAuditLog } from "@/lib/audit";
import type { HospitalActor } from "@/lib/authz/hospital";
import { invoiceDue } from "@/lib/billing/rules";
import { patientName } from "@/lib/display";
import { ensureLabInvoice, syncLabOrderPaymentFromInvoice } from "@/lib/lab";
import { canCollectLabPayment, validateLabCollectionPayment } from "@/lib/lab-orders/rules";
import type { LabActionResult } from "@/lib/lab-orders/types";
import { invoiceStatusFromTotals, paymentNote } from "@/lib/opd/fees";
import { prisma } from "@/lib/prisma";
import { activeSignatureFor } from "@/lib/signatures";
import { hospitalScope } from "@/lib/tenancy";

export async function collectLabOrderPayment(params: {
  request: Request;
  user: HospitalActor;
  orderId: string;
  method: string;
  amount?: number;
  cardBrand?: string;
  cardLast4?: string;
  referenceNo?: string;
}): Promise<LabActionResult> {
  const order = await prisma.labOrder.findFirst({
    where: { id: params.orderId, ...hospitalScope(params.user.hospitalId) },
    include: { patient: true, items: true, invoice: true },
  });
  if (!order) {
    return { ok: false, error: "Lab order not found.", status: 404 };
  }
  const allowed = canCollectLabPayment({
    fulfillment: order.fulfillment,
    status: order.status,
    itemCount: order.items.length,
  });
  if (!allowed.ok) return allowed;

  const hospital = params.user.hospital ?? (await prisma.hospital.findUnique({ where: { id: params.user.hospitalId } }));
  if (!hospital) {
    return { ok: false, error: "Hospital not found.", status: 400 };
  }

  const invoice =
    order.invoice ??
    (await ensureLabInvoice({
      orderId: order.id,
      hospitalId: params.user.hospitalId,
      hospitalCode: hospital.code,
    }));
  if (!invoice) {
    return { ok: false, error: "Could not prepare the lab invoice.", status: 400 };
  }

  const due = invoiceDue(invoice.netTotal, invoice.paidAmount);
  const method = params.method || "CASH";
  const amount = params.amount ?? due;
  const valid = validateLabCollectionPayment({
    method,
    amount,
    due,
    cardBrand: params.cardBrand,
  });
  if (!valid.ok) return valid;

  if (due > 0.05) {
    const cardLast4 = (params.cardLast4 ?? "").replace(/\D/g, "").slice(-4);
    const notes = paymentNote({
      method,
      cardBrand: method === "CARD" ? params.cardBrand ?? null : null,
      cardLast4: method === "CARD" && cardLast4.length === 4 ? cardLast4 : null,
      referenceNo: method === "CARD" || method === "UPI" ? params.referenceNo || null : null,
      extra: `Lab tests · ${order.items.map((item) => item.nameSnapshot).join(", ")}`,
    });
    const paidAmount = Number(invoice.paidAmount) + amount;
    const signature = await activeSignatureFor(params.user.id, params.user.hospitalId);
    await prisma.$transaction([
      prisma.payment.create({
        data: {
          hospitalId: params.user.hospitalId,
          patientId: order.patientId,
          invoiceId: invoice.id,
          kind: "COLLECTION",
          method: method as "CASH" | "CARD" | "UPI",
          amount,
          notes,
          receivedByUserId: params.user.id,
          receivedBySignatureId: signature?.id ?? null,
        },
      }),
      prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          paidAmount,
          status: invoiceStatusFromTotals(Number(invoice.netTotal), paidAmount),
        },
      }),
    ]);
  } else {
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: invoiceStatusFromTotals(Number(invoice.netTotal), Number(invoice.paidAmount)) },
    });
  }

  await syncLabOrderPaymentFromInvoice(invoice.id);

  await writeAuditLog({
    request: params.request,
    hospitalId: params.user.hospitalId,
    actorUserId: params.user.id,
    actorUsername: params.user.username,
    actorRole: params.user.role,
    action: "LAB_PAYMENT_COLLECTED",
    entity: "LabOrder",
    entityId: order.id,
    summary: `${params.user.username} collected lab payment ${invoice.invoiceNo} for ${patientName(order.patient)}.`,
    metadata: {
      changes: diffAuditFields(
        { paidAmount: invoice.paidAmount, status: invoice.status, orderStatus: order.status },
        {
          paidAmount: Number(invoice.paidAmount) + (due > 0.05 ? amount : 0),
          status: invoiceStatusFromTotals(
            Number(invoice.netTotal),
            Number(invoice.paidAmount) + (due > 0.05 ? amount : 0),
          ),
          orderStatus: "PAID",
        },
        { fields: ["paidAmount", "status", "orderStatus"] },
      ),
    },
  });

  return { ok: true, body: { ok: true, invoice: { id: invoice.id }, orderId: order.id } };
}
