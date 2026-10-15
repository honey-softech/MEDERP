import type { PaymentMethod, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  pricingFromTier,
  staffSeatLimit,
  type PricingLine,
  type SubscriptionSelection,
} from "@/lib/platform-pricing";
import {
  getSubscriptionTier,
  isSubscriptionTierId,
  type SubscriptionTierId,
} from "@/lib/subscription-tiers";

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

export async function calculateRegistrationTotal(selection: SubscriptionSelection | { tierId: string; extraUsers?: number }) {
  if (!isSubscriptionTierId(selection.tierId)) {
    throw new Error("Choose a subscription plan.");
  }
  const extraUsers = "extraUsers" in selection ? Math.max(0, Math.trunc(Number(selection.extraUsers) || 0)) : 0;
  return pricingFromTier(selection.tierId, extraUsers);
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
  const [settings, hospital] = await Promise.all([
    getPlatformBillingSettings(),
    prisma.hospital.findUnique({
      where: { id: params.hospitalId },
      select: { name: true, code: true, address: true, phone: true },
    }),
  ]);
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
      issuerName: settings.companyName,
      issuerAddress: settings.companyAddress,
      issuerPhone: settings.companyPhone,
      issuerEmail: settings.companyEmail,
      issuerGstin: settings.gstin,
      issuerBankDetails: settings.bankDetails,
      issuerTermsNote: settings.termsNote,
      billedHospitalName: hospital?.name ?? null,
      billedHospitalCode: hospital?.code ?? null,
      billedHospitalAddress: hospital?.address ?? null,
      billedHospitalPhone: hospital?.phone ?? null,
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

/** Active hospital logins. Each plan's seat limit includes the hospital admin. */
export async function countHospitalStaffSeats(hospitalId: string) {
  return prisma.appUser.count({
    where: {
      hospitalId,
      isActive: true,
      role: { notIn: ["SOFTWARE_ADMIN", "HELPDESK"] },
    },
  });
}

/** Admin-as-doctor uses the same login, so it does not take another seat. */
export async function assertSeatIfAdminBecomesDoctor(
  hospitalId: string,
  options: { adminAlreadyActiveDoctor: boolean; freesAnotherActiveLogin: boolean },
) {
  void hospitalId;
  void options;
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

export async function assertPatientCapacity(hospitalId: string) {
  const hospital = await prisma.hospital.findUnique({
    where: { id: hospitalId },
    select: { subscriptionTier: true },
  });
  if (!hospital) throw new Error("Hospital not found.");
  const tier = getSubscriptionTier(hospital.subscriptionTier);
  if (!tier) return { used: 0, limit: null as number | null };
  const used = await prisma.patient.count({
    where: { hospitalId, mergedIntoId: null },
  });
  if (used >= tier.patientLimit) {
    throw new Error(
      `Patient limit reached (${used}/${tier.patientLimit}). Upgrade your subscription plan to register more patients.`,
    );
  }
  return { used, limit: tier.patientLimit };
}

export async function applyHospitalTier(hospitalId: string, tierId: SubscriptionTierId | string) {
  const quote = await calculateRegistrationTotal({ tierId });
  // Preserve manually granted extra seats; platform support may add them outside a tier change.
  const fields = {
    subscriptionTier: quote.tier.id,
    includedStaffSlots: quote.includedStaffSlots,
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
