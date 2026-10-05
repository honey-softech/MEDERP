import type { Prisma } from "@prisma/client";
import { buildBillReceiptPdf } from "@/lib/bill-receipt-pdf";
import { letterheadPhoneText } from "@/lib/hospital-letterhead";
import { resolveReceiptCollector } from "@/lib/billing/receipt-collector";
import { billPdfFilename } from "@/lib/billing/rules";
import { doctorName, patientName } from "@/lib/display";
import { prisma } from "@/lib/prisma";
import { hospitalScope } from "@/lib/tenancy";

export const invoiceReceiptInclude = {
  patient: true,
  hospital: { select: { name: true, address: true, phone: true, altPhones: true } },
  items: true,
  payments: {
    orderBy: { receivedAt: "desc" as const },
    include: {
      receivedBySignature: { select: { imageData: true, displayName: true, credentials: true } },
    },
  },
  appointment: {
    include: {
      doctor: { include: { appUser: { select: { username: true, firstName: true, lastName: true } } } },
      department: { select: { name: true } },
    },
  },
} satisfies Prisma.InvoiceInclude;

export type InvoiceForReceipt = Prisma.InvoiceGetPayload<{ include: typeof invoiceReceiptInclude }>;

export async function findInvoiceForReceipt(hospitalId: string, invoiceId: string) {
  return prisma.invoice.findFirst({
    where: { id: invoiceId, ...hospitalScope(hospitalId) },
    include: invoiceReceiptInclude,
  });
}

export async function renderInvoiceReceiptPdf(invoice: InvoiceForReceipt) {
  const visitLine = invoice.appointment
    ? `${doctorName(invoice.appointment.doctor)} · ${invoice.appointment.department.name}`
    : null;
  const pdf = await buildBillReceiptPdf({
    hospitalName: invoice.issuedHospitalName || invoice.hospital.name,
    hospitalAddress: invoice.issuedHospitalAddress || invoice.hospital.address,
    hospitalPhone: letterheadPhoneText(
      invoice.issuedHospitalPhone || invoice.hospital.phone,
      invoice.hospital.altPhones,
    ),
    invoiceNo: invoice.invoiceNo,
    issuedAt: invoice.issuedAt,
    status: invoice.status,
    patientName: invoice.issuedPatientName || patientName(invoice.patient),
    patientMrn: invoice.issuedPatientMrn || invoice.patient.mrn,
    visitLine,
    items: invoice.items,
    subtotal: invoice.subtotal,
    discountAmount: invoice.discountAmount,
    waiverAmount: invoice.waiverAmount,
    waiverReason: invoice.waiverReason,
    showWaiver: invoice.waiverStatus === "APPROVED",
    netTotal: invoice.netTotal,
    paidAmount: invoice.paidAmount,
    payments: invoice.payments,
    collector: await resolveReceiptCollector(invoice.payments),
  });
  return { pdf, filename: billPdfFilename(invoice.invoiceNo) };
}

export async function loadInvoiceReceiptPdf(params: { hospitalId: string; invoiceId: string }) {
  const invoice = await findInvoiceForReceipt(params.hospitalId, params.invoiceId);
  if (!invoice) {
    return { ok: false as const, error: "Invoice not found.", status: 404 };
  }
  const rendered = await renderInvoiceReceiptPdf(invoice);
  return { ok: true as const, ...rendered };
}
