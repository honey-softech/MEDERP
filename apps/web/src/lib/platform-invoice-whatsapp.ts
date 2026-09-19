import type { Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { hasSendableMobile, patientMobileDigits } from "@/lib/billing/rules";
import { inr } from "@/lib/display";
import { deliverMessage, messagingProvider } from "@/lib/messaging/providers";
import { renderTemplate } from "@/lib/messaging/templates";
import { uploadWhatsAppDocument } from "@/lib/messaging/whatsapp-media";
import { getPlatformBillingSettings } from "@/lib/platform-billing";
import { buildPlatformInvoicePdf, subscriptionBillFilename } from "@/lib/platform-invoice-pdf";
import { prisma } from "@/lib/prisma";

export function adminDisplayName(user: {
  firstName?: string | null;
  lastName?: string | null;
  username: string;
}) {
  const full = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return full || user.username;
}

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LONG_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function billingPeriodLabel(start?: Date | null, end?: Date | null, fallback?: Date | null) {
  const fmt = (value: Date) => `${value.getDate()} ${SHORT_MONTHS[value.getMonth()]} ${value.getFullYear()}`;
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (fallback) return `${LONG_MONTHS[fallback.getMonth()]} ${fallback.getFullYear()}`;
  return "this billing cycle";
}

async function hospitalSoftwareAdmin(hospitalId: string) {
  return prisma.appUser.findFirst({
    where: { hospitalId, role: "SUPER_ADMIN" },
    orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      username: true,
      mobile: true,
      firstName: true,
      lastName: true,
      isActive: true,
    },
  });
}

export async function sendSubscriptionInvoiceWhatsApp(invoiceId: string) {
  const invoice = await prisma.platformInvoice.findUnique({
    where: { id: invoiceId },
    include: { items: true, hospital: true },
  });
  if (!invoice) {
    console.error(`[subscription-bill] invoice ${invoiceId} not found`);
    return { ok: false as const, error: "Invoice not found." };
  }

  const [settings, subscription, admin] = await Promise.all([
    getPlatformBillingSettings(),
    prisma.hospitalSubscription.findUnique({
      where: { hospitalId: invoice.hospitalId },
      select: { currentPeriodStart: true, currentPeriodEnd: true },
    }),
    hospitalSoftwareAdmin(invoice.hospitalId),
  ]);

  if (!admin || !hasSendableMobile(admin.mobile)) {
    console.error(
      `[subscription-bill] no SUPER_ADMIN mobile for hospital ${invoice.hospital.code}; invoice ${invoice.invoiceNo} still PAID`,
    );
    await writeAuditLog({
      hospitalId: invoice.hospitalId,
      actorUsername: "subscription-renewal",
      actorRole: "SOFTWARE_ADMIN",
      action: "SUBSCRIPTION_BILL_SKIPPED",
      entity: "PlatformInvoice",
      entityId: invoice.id,
      summary: `Skipped subscription bill WhatsApp for ${invoice.invoiceNo}: hospital SUPER_ADMIN mobile is missing.`,
    });
    return { ok: false as const, error: "Hospital SUPER_ADMIN mobile is missing." };
  }

  const phone = patientMobileDigits(admin.mobile);
  const adminName = adminDisplayName(admin);
  const period = billingPeriodLabel(
    subscription?.currentPeriodStart,
    subscription?.currentPeriodEnd,
    invoice.paidAt ?? invoice.issuedAt,
  );
  const variables = {
    admin: adminName,
    hospital: invoice.hospital.name,
    invoiceNo: invoice.invoiceNo,
    total: inr(invoice.netTotal),
    period,
  };
  const body = renderTemplate("subscription_bill", variables);
  const filename = subscriptionBillFilename(invoice.invoiceNo);
  const pdf = await buildPlatformInvoicePdf({
    companyName: settings.companyName,
    companyAddress: settings.companyAddress,
    companyPhone: settings.companyPhone,
    companyEmail: settings.companyEmail,
    gstin: settings.gstin,
    bankDetails: settings.bankDetails,
    termsNote: settings.termsNote,
    invoiceNo: invoice.invoiceNo,
    issuedAt: invoice.issuedAt,
    paidAt: invoice.paidAt,
    status: invoice.status,
    paymentMethod: invoice.paymentMethod,
    notes: invoice.notes,
    hospitalName: invoice.hospital.name,
    hospitalCode: invoice.hospital.code,
    hospitalAddress: invoice.hospital.address,
    hospitalPhone: invoice.hospital.phone,
    billedToName: adminName,
    billedToMobile: phone.slice(-10),
    periodLabel: period,
    items: invoice.items,
    netTotal: invoice.netTotal,
  });

  let documentMediaId: string | undefined;
  if (messagingProvider() === "whatsapp") {
    const uploaded = await uploadWhatsAppDocument({ buffer: pdf, filename });
    if (!uploaded.ok) {
      await writeAuditLog({
        hospitalId: invoice.hospitalId,
        actorUsername: "subscription-renewal",
        actorRole: "SOFTWARE_ADMIN",
        action: "SUBSCRIPTION_BILL_FAILED",
        entity: "PlatformInvoice",
        entityId: invoice.id,
        summary: `Failed to publish subscription bill PDF ${invoice.invoiceNo}: ${uploaded.error}`,
      });
      return { ok: false as const, error: uploaded.error };
    }
    documentMediaId = uploaded.mediaId;
  }

  const result = await deliverMessage({
    toPhone: phone,
    channel: "WHATSAPP",
    body,
    templateKey: "subscription_bill",
    variables,
    documentMediaId,
    documentFilename: filename,
  });

  await prisma.outboundMessage.create({
    data: {
      hospitalId: invoice.hospitalId,
      channel: "WHATSAPP",
      templateKey: "subscription_bill",
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
    hospitalId: invoice.hospitalId,
    actorUsername: "subscription-renewal",
    actorRole: "SOFTWARE_ADMIN",
    action: result.ok ? "SUBSCRIPTION_BILL_SENT" : "SUBSCRIPTION_BILL_FAILED",
    entity: "PlatformInvoice",
    entityId: invoice.id,
    summary: result.ok
      ? `Sent subscription bill ${invoice.invoiceNo} on WhatsApp to SUPER_ADMIN ${admin.username}.`
      : `Failed to send subscription bill ${invoice.invoiceNo}: ${result.error}`,
    metadata: { adminUserId: admin.id, providerMessageId: result.ok ? result.providerMessageId : null },
  });

  return result;
}

/** Never throws — a WhatsApp failure must not roll back a successful Razorpay charge. */
export async function notifySubscriptionRenewalBill(invoiceId: string) {
  try {
    return await sendSubscriptionInvoiceWhatsApp(invoiceId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Subscription bill WhatsApp failed.";
    console.error(`[subscription-bill] ${message}`);
    return { ok: false as const, error: message };
  }
}
