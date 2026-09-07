import type { Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import type { HospitalActor } from "@/lib/authz/hospital";
import { buildBillReceiptPdf } from "@/lib/bill-receipt-pdf";
import {
  billPdfFilename,
  canSendIssuedInvoice,
  hasSendableMobile,
  invoiceDue,
  patientMobileDigits,
} from "@/lib/billing/rules";
import type { BillingActionResult } from "@/lib/billing/types";
import { doctorName, inr, patientName } from "@/lib/display";
import { deliverMessage, messagingProvider } from "@/lib/messaging/providers";
import { renderTemplate } from "@/lib/messaging/templates";
import { uploadWhatsAppDocument } from "@/lib/messaging/whatsapp-media";
import { prisma } from "@/lib/prisma";
import { hospitalScope } from "@/lib/tenancy";

export async function sendInvoiceWhatsApp(params: {
  request: Request;
  user: HospitalActor;
  invoiceId: string;
}): Promise<BillingActionResult> {
  const invoice = await prisma.invoice.findFirst({
    where: { id: params.invoiceId, ...hospitalScope(params.user.hospitalId) },
    include: {
      patient: true,
      hospital: { select: { name: true, address: true, phone: true } },
      items: true,
      payments: { orderBy: { receivedAt: "desc" } },
      appointment: {
        include: {
          doctor: { include: { appUser: { select: { username: true } } } },
          department: { select: { name: true } },
        },
      },
    },
  });
  if (!invoice) {
    return { ok: false, error: "Invoice not found.", status: 404 };
  }
  if (!canSendIssuedInvoice(invoice.status)) {
    return { ok: false, error: "Issue the invoice before sending the bill on WhatsApp.", status: 400 };
  }
  if (!hasSendableMobile(invoice.patient.phone)) {
    return { ok: false, error: "Add a 10-digit mobile number on the patient record first.", status: 400 };
  }

  const phone = patientMobileDigits(invoice.patient.phone);
  const due = invoiceDue(invoice.netTotal, invoice.paidAmount);
  const variables = {
    patient: patientName(invoice.patient),
    invoiceNo: invoice.invoiceNo,
    hospital: invoice.hospital.name,
    total: inr(invoice.netTotal),
    paid: inr(invoice.paidAmount),
    due: inr(due),
  };
  const body = renderTemplate("bill_receipt", variables);
  const filename = billPdfFilename(invoice.invoiceNo);
  const visitLine = invoice.appointment
    ? `${doctorName(invoice.appointment.doctor)} · ${invoice.appointment.department.name}`
    : null;

  const pdf = await buildBillReceiptPdf({
    hospital: invoice.hospital,
    patient: invoice.patient,
    invoiceNo: invoice.invoiceNo,
    status: invoice.status,
    issuedAt: invoice.issuedAt,
    items: invoice.items,
    subtotal: invoice.subtotal,
    discountAmount: invoice.discountAmount,
    waiverAmount: invoice.waiverAmount,
    netTotal: invoice.netTotal,
    paidAmount: invoice.paidAmount,
    payments: invoice.payments,
    visitLine,
  });

  let documentMediaId: string | undefined;
  if (messagingProvider() === "whatsapp") {
    const uploaded = await uploadWhatsAppDocument({ buffer: pdf, filename });
    if (!uploaded.ok) {
      return { ok: false, error: uploaded.error, status: 502 };
    }
    documentMediaId = uploaded.mediaId;
  }

  const result = await deliverMessage({
    toPhone: phone,
    channel: "WHATSAPP",
    body,
    templateKey: "bill_receipt",
    variables,
    documentMediaId,
    documentFilename: filename,
  });

  const outbound = await prisma.outboundMessage.create({
    data: {
      hospitalId: params.user.hospitalId,
      patientId: invoice.patientId,
      appointmentId: invoice.appointmentId,
      channel: "WHATSAPP",
      templateKey: "bill_receipt",
      variables: variables as Prisma.InputJsonValue,
      toPhone: phone,
      body,
      status: result.ok ? "SENT" : "FAILED",
      attempts: 1,
      providerMessageId: result.ok ? (result.providerMessageId ?? null) : null,
      error: result.ok ? null : result.error,
      sentAt: result.ok ? new Date() : null,
    },
  });

  await writeAuditLog({
    request: params.request,
    hospitalId: params.user.hospitalId,
    actorUserId: params.user.id,
    actorUsername: params.user.username,
    actorRole: params.user.role,
    action: result.ok ? "BILL_RECEIPT_SENT" : "BILL_RECEIPT_FAILED",
    entity: "Invoice",
    entityId: invoice.id,
    summary: result.ok
      ? `${params.user.username} sent WhatsApp bill PDF ${invoice.invoiceNo} to ${patientName(invoice.patient)}.`
      : `${params.user.username} failed to send WhatsApp bill ${invoice.invoiceNo}: ${result.error}`,
    metadata: { outboundMessageId: outbound.id, providerMessageId: result.ok ? result.providerMessageId : null },
  });

  if (!result.ok) {
    return { ok: false, error: result.error, status: 502 };
  }
  return { ok: true, body: { ok: true, status: "SENT", providerMessageId: result.providerMessageId } };
}
