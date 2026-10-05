import type { Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import type { HospitalActor } from "@/lib/authz/hospital";
import { findInvoiceForReceipt, renderInvoiceReceiptPdf } from "@/lib/billing/receipt-pdf";
import {
  canSendIssuedInvoice,
  hasSendableMobile,
  invoiceDue,
  patientMobileDigits,
} from "@/lib/billing/rules";
import type { BillingActionResult } from "@/lib/billing/types";
import { inr, patientName } from "@/lib/display";
import { deliverMessage, messagingProvider } from "@/lib/messaging/providers";
import { renderTemplate } from "@/lib/messaging/templates";
import { uploadWhatsAppDocument } from "@/lib/messaging/whatsapp-media";
import { prisma } from "@/lib/prisma";

export async function sendInvoiceWhatsApp(params: {
  request: Request;
  user: HospitalActor;
  invoiceId: string;
}): Promise<BillingActionResult> {
  const invoice = await findInvoiceForReceipt(params.user.hospitalId, params.invoiceId);
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
    patient: invoice.issuedPatientName || patientName(invoice.patient),
    invoiceNo: invoice.invoiceNo,
    hospital: invoice.issuedHospitalName || invoice.hospital.name,
    total: inr(invoice.netTotal),
    paid: inr(invoice.paidAmount),
    due: inr(due),
  };
  const body = renderTemplate("bill_receipt", variables);
  const { pdf, filename } = await renderInvoiceReceiptPdf(invoice);

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
