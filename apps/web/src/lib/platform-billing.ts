import type { PaymentMethod, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  pricingFromTier,
  staffSeatLimit,
  type PricingLine,
  type SubscriptionSelection,
} from "@/lib/platform-pricing";
import { isSubscriptionTierId, type SubscriptionTierId } from "@/lib/subscription-tiers";

const SETTINGS_ID = "default";
const INVOICE_COUNTER = "platform_invoice";

export async function getPlatformBillingSettings() {
  return prisma.platformBillingSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID },
    update: {},
  });
}

export async function updatePlatformBillingSettings(
  data: Prisma.PlatformBillingSettingsUpdateInput,
) {
  return prisma.platformBillingSettings.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      companyName: String(data.companyName ?? "MedERP Software Pvt Ltd"),
      companyAddress: data.companyAddress != null ? String(data.companyAddress) : null,
      companyPhone: data.companyPhone != null ? String(data.companyPhone) : null,
      companyEmail: data.companyEmail != null ? String(data.companyEmail) : null,
      gstin: data.gstin != null ? String(data.gstin) : null,
      invoicePrefix: String(data.invoicePrefix ?? "MEDERP"),
      bankDetails: data.bankDetails != null ? String(data.bankDetails) : null,
      termsNote: data.termsNote != null ? String(data.termsNote) : null,
      basePackageFee: data.basePackageFee != null ? Number(data.basePackageFee) : 4000,
      includedStaffSlots:
        data.includedStaffSlots != null ? Number(data.includedStaffSlots) : 3,
      extraUserFee: data.extraUserFee != null ? Number(data.extraUserFee) : 1000,
      pharmacyModuleFee:
        data.pharmacyModuleFee != null ? Number(data.pharmacyModuleFee) : 1000,
      labModuleFee: data.labModuleFee != null ? Number(data.labModuleFee) : 1000,
    },
    update: data,
  });
}

async function nextPlatformInvoiceNo(prefix: string) {
  const counter = await prisma.platformCounter.upsert({
    where: { kind: INVOICE_COUNTER },
    create: { kind: INVOICE_COUNTER, value: 1 },
    update: { value: { increment: 1 } },
  });
  const seq = String(counter.value).padStart(5, "0");
  return `${prefix}-INV-${seq}`;
}

export async function calculateRegistrationTotal(selection: SubscriptionSelection | { tierId: string }) {
  if (!isSubscriptionTierId(selection.tierId)) {
    throw new Error("Choose a subscription plan.");
  }
  return pricingFromTier(selection.tierId);
}

export async function createPlatformInvoice(params: {
  hospitalId: string;
  lines: PricingLine[];
  total: number;
  paymentMethod?: PaymentMethod | null;
  notes?: string | null;
  status?: "PAID" | "ISSUED";
  razorpayPaymentId?: string | null;
  razorpaySubscriptionId?: string | null;
}) {
  const settings = await getPlatformBillingSettings();
  const invoiceNo = await nextPlatformInvoiceNo(settings.invoicePrefix);
  const now = new Date();
  const status = params.status ?? "PAID";

  return prisma.platformInvoice.create({
    data: {
      invoiceNo,
      hospitalId: params.hospitalId,
      status,
      subtotal: params.total,
      netTotal: params.total,
      paidAmount: status === "PAID" ? params.total : 0,
      paymentMethod: params.paymentMethod ?? null,
      notes: params.notes?.trim() || null,
      paidAt: status === "PAID" ? now : null,
      razorpayPaymentId: params.razorpayPaymentId ?? null,
      razorpaySubscriptionId: params.razorpaySubscriptionId ?? null,
      items: {
        create: params.lines.map((line) => ({
          description: line.description,
          amount: line.amount,
        })),
      },
    },
    include: { items: true, hospital: true },
  });
}

export async function countHospitalStaffSeats(hospitalId: string) {
  return prisma.appUser.count({
    where: {
      hospitalId,
      isActive: true,
      role: { notIn: ["SUPER_ADMIN", "SOFTWARE_ADMIN", "HELPDESK"] },
    },
  });
}

export async function assertStaffSeatAvailable(hospitalId: string) {
  const hospital = await prisma.hospital.findUnique({
    where: { id: hospitalId },
    select: {
      includedStaffSlots: true,
      extraStaffSlots: true,
      unlimitedStaffSeats: true,
      subscriptionTier: true,
      name: true,
    },
  });
  if (!hospital) throw new Error("Hospital not found.");

  const used = await countHospitalStaffSeats(hospitalId);
  const limit = staffSeatLimit(hospital);
  if (limit == null) {
    return { used, limit: null as number | null };
  }
  if (used >= limit) {
    throw new Error(
      `Staff user limit reached (${used}/${limit}). Upgrade your subscription plan for more seats.`,
    );
  }
  return { used, limit };
}

export async function applyHospitalTier(hospitalId: string, tierId: SubscriptionTierId | string) {
  const quote = await calculateRegistrationTotal({ tierId });
  const fields = {
    subscriptionTier: quote.tier.id,
    includedStaffSlots: quote.includedStaffSlots,
    extraStaffSlots: 0,
    unlimitedStaffSeats: quote.unlimitedStaffSeats,
    pharmacyEnabled: quote.pharmacyEnabled,
    labEnabled: quote.labEnabled,
    inventoryEnabled: quote.inventoryEnabled,
  };
  await prisma.hospital.update({ where: { id: hospitalId }, data: fields });
  return { fields, quote };
}

export async function addHospitalSeatsAndInvoice(params: {
  hospitalId: string;
  tierId: string;
  paymentMethod?: PaymentMethod | null;
  notes?: string | null;
}) {
  const hospital = await prisma.hospital.findUnique({ where: { id: params.hospitalId } });
  if (!hospital) throw new Error("Hospital not found.");

  const { fields, quote } = await applyHospitalTier(hospital.id, params.tierId);

  return createPlatformInvoice({
    hospitalId: hospital.id,
    lines: quote.lines,
    total: quote.total,
    paymentMethod: params.paymentMethod,
    notes: params.notes ?? `Plan change → ${fields.subscriptionTier}`,
  });
}
