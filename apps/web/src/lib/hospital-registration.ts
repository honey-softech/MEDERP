import type { AppRole, PaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { hashPassword, MIN_PASSWORD_LENGTH, normalizeHospitalCode, normalizeMobile, passwordValidationError } from "@/lib/auth";
import {
  HOSPITAL_CODE_LENGTH,
  isCanonicalHospitalCode,
  isValidHospitalCode,
  slugFromHospitalName,
} from "@/lib/hospital-code";
import { mobileValidationError } from "@/lib/phone";
import { allocateHospitalUserIdentity } from "@/lib/employee";
import { seedHospitalDepartments } from "@/lib/front-desk";
import { seedHospitalWards } from "@/lib/wards";
import { calculateRegistrationTotal, createPlatformInvoice } from "@/lib/platform-billing";
import { upsertHospitalSubscription, unixToDate } from "@/lib/hospital-subscription";
import { isSubscriptionTierId, type SubscriptionTierId } from "@/lib/subscription-tiers";
import { pricingFromSettings } from "@/lib/platform-pricing";

export class HospitalRegistrationError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export type RegisterHospitalInput = {
  name: string;
  code: string;
  address?: string | null;
  phone?: string | null;
  adminUsername: string;
  adminMobile: string;
  adminEmail?: string | null;
  adminPassword: string;
  tierId?: string;
  /** @deprecated use tierId */
  extraStaffSlots?: number;
  /** @deprecated use tierId */
  pharmacyEnabled?: boolean;
  /** @deprecated use tierId */
  labEnabled?: boolean;
  invoiceStatus?: "PAID" | "ISSUED";
  trialEndsAt?: Date | null;
  paymentMethod?: PaymentMethod | null;
  paymentNotes?: string | null;
  termsAccepted?: boolean;
  razorpayPlanId?: string | null;
  razorpaySubscriptionId?: string | null;
  razorpayPaymentId?: string | null;
  subscriptionCurrentStart?: number | null;
  subscriptionCurrentEnd?: number | null;
  subscriptionChargeAt?: number | null;
  actor: {
    userId?: string | null;
    username: string;
    role?: AppRole | string | null;
  };
  request?: Request;
};

export async function allocateUniqueHospitalCode(name: string, requested?: string | null) {
  const preferred = requested ? normalizeHospitalCode(requested) : "";
  const base =
    (isCanonicalHospitalCode(preferred) ? preferred : slugFromHospitalName(name)) || "HOSPITAL";
  const candidates = [base];
  for (let i = 2; i <= 99; i++) {
    const suffix = String(i);
    candidates.push(`${base.slice(0, HOSPITAL_CODE_LENGTH - suffix.length)}${suffix}`);
  }
  candidates.push(`HSP${Date.now().toString(36).toUpperCase()}`.replace(/[^A-Z0-9]/g, "").slice(0, HOSPITAL_CODE_LENGTH));

  for (const code of candidates) {
    if (!isValidHospitalCode(code)) continue;
    const taken = await prisma.hospital.findUnique({ where: { code } });
    if (!taken) return code;
  }
  return `HSP${Date.now().toString(36).toUpperCase()}`.replace(/[^A-Z0-9]/g, "").slice(0, HOSPITAL_CODE_LENGTH);
}

export type PreparedRegistration = {
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  adminUsername: string;
  adminMobile: string;
  adminEmail: string;
  adminPassword: string;
  tierId: SubscriptionTierId;
  quote: Awaited<ReturnType<typeof calculateRegistrationTotal>>;
};

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function resolveTierId(input: {
  tierId?: string;
  extraStaffSlots?: number;
  pharmacyEnabled?: boolean;
  labEnabled?: boolean;
}): SubscriptionTierId {
  if (input.tierId && isSubscriptionTierId(input.tierId)) return input.tierId;
  // Legacy payload → nearest fixed tier
  return pricingFromSettings(null, {
    extraStaffSlots: input.extraStaffSlots ?? 0,
    pharmacyEnabled: Boolean(input.pharmacyEnabled),
    labEnabled: Boolean(input.labEnabled),
  }).tier.id;
}

/** Validate registration fields and compute quote without creating the hospital. */
export async function prepareHospitalRegistration(
  input: Omit<
    RegisterHospitalInput,
    | "actor"
    | "request"
    | "invoiceStatus"
    | "paymentMethod"
    | "paymentNotes"
    | "razorpayPlanId"
    | "razorpaySubscriptionId"
    | "razorpayPaymentId"
    | "subscriptionCurrentStart"
    | "subscriptionCurrentEnd"
    | "subscriptionChargeAt"
  >,
): Promise<PreparedRegistration> {
  const name = input.name.trim();
  const address = input.address?.trim() || null;
  const phone = normalizeMobile(String(input.phone ?? ""));
  const adminUsername = input.adminUsername.trim();
  const adminMobile = normalizeMobile(input.adminMobile);
  const adminEmail = normalizeEmail(String(input.adminEmail ?? ""));
  const adminPassword = input.adminPassword;
  const tierId = resolveTierId(input);

  if (!name) {
    throw new HospitalRegistrationError("Hospital name is required.", 400);
  }
  const hospitalPhoneError = mobileValidationError(phone, "Hospital mobile");
  if (hospitalPhoneError) {
    throw new HospitalRegistrationError(hospitalPhoneError, 400);
  }
  const adminMobileError = mobileValidationError(adminMobile, "Super admin mobile");
  if (adminMobileError) {
    throw new HospitalRegistrationError(adminMobileError, 400);
  }
  if (!isValidEmail(adminEmail)) {
    throw new HospitalRegistrationError("Enter a valid super admin email for payment receipts.", 400);
  }
  if (adminUsername.length < 3 || !/^[a-zA-Z0-9._]+$/.test(adminUsername)) {
    throw new HospitalRegistrationError(
      "Super admin username must be at least 3 letters, numbers, dots, or underscores.",
      400,
    );
  }
  if (passwordValidationError(adminPassword)) {
    throw new HospitalRegistrationError(
      `Super admin password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      400,
    );
  }

  const code = await allocateUniqueHospitalCode(name, input.code);

  const phoneTaken = await prisma.hospital.findFirst({ where: { phone } });
  if (phoneTaken) {
    throw new HospitalRegistrationError("That hospital mobile number is already registered.", 409);
  }

  const userTaken = await prisma.appUser.findFirst({
    where: { OR: [{ username: adminUsername }, { mobile: adminMobile }] },
  });
  if (userTaken) {
    throw new HospitalRegistrationError(
      userTaken.mobile === adminMobile
        ? "That super admin mobile number is already registered. Sign in with this number, or use another."
        : "Super admin username is already in use.",
      409,
    );
  }

  const quote = await calculateRegistrationTotal({ tierId });

  if (!(quote.total > 0)) {
    throw new HospitalRegistrationError("Registration total must be greater than zero.", 400);
  }

  return {
    name,
    code,
    address,
    phone,
    adminUsername,
    adminMobile,
    adminEmail,
    adminPassword,
    tierId,
    quote,
  };
}

export async function registerHospital(input: RegisterHospitalInput) {
  if (input.termsAccepted === false) {
    throw new HospitalRegistrationError("You must accept the Terms & Conditions to register.", 400);
  }

  const prepared = await prepareHospitalRegistration(input);
  const invoiceStatus = input.invoiceStatus ?? "ISSUED";
  const tier = prepared.quote.tier;

  const hospital = await prisma.hospital.create({
    data: {
      name: prepared.name,
      code: prepared.code,
      address: prepared.address,
      phone: prepared.phone,
      subscriptionTier: tier.id,
      includedStaffSlots: prepared.quote.includedStaffSlots,
      extraStaffSlots: 0,
      unlimitedStaffSeats: prepared.quote.unlimitedStaffSeats,
      pharmacyEnabled: tier.pharmacyEnabled,
      labEnabled: tier.labEnabled,
      inventoryEnabled: tier.inventoryEnabled,
      trialEndsAt: input.trialEndsAt ?? null,
      users: {
        create: {
          username: prepared.adminUsername,
          mobile: prepared.adminMobile,
          email: prepared.adminEmail,
          passwordHash: await hashPassword(prepared.adminPassword),
          isVerified: true,
          role: "SUPER_ADMIN",
        },
      },
    },
    include: {
      users: {
        where: { role: "SUPER_ADMIN" },
        select: { id: true, username: true, mobile: true, email: true, role: true },
      },
    },
  });

  await seedHospitalDepartments(hospital.id);
  await seedHospitalWards(hospital.id);

  const superAdmin = hospital.users[0];
  if (superAdmin) {
    const identity = await allocateHospitalUserIdentity(hospital.id, "SUPER_ADMIN", hospital.code);
    await prisma.appUser.update({
      where: { id: superAdmin.id },
      data: identity,
    });
  }

  const invoice = await createPlatformInvoice({
    hospitalId: hospital.id,
    lines: prepared.quote.lines,
    total: prepared.quote.total,
    paymentMethod: input.paymentMethod ?? null,
    notes: input.paymentNotes ?? `Hospital registration — ${hospital.code} — ${tier.name}`,
    status: invoiceStatus,
    razorpayPaymentId: input.razorpayPaymentId ?? null,
    razorpaySubscriptionId: input.razorpaySubscriptionId ?? null,
  });

  if (input.razorpaySubscriptionId && input.razorpayPlanId) {
    await upsertHospitalSubscription({
      hospitalId: hospital.id,
      razorpayPlanId: input.razorpayPlanId,
      razorpaySubscriptionId: input.razorpaySubscriptionId,
      monthlyAmount: prepared.quote.total,
      status: "ACTIVE",
      termsAcceptedAt: new Date(),
      currentPeriodStart: unixToDate(input.subscriptionCurrentStart),
      currentPeriodEnd: unixToDate(input.subscriptionCurrentEnd),
      nextChargeAt: unixToDate(input.subscriptionChargeAt),
    });
  }

  await writeAuditLog({
    request: input.request,
    hospitalId: hospital.id,
    actorUserId: input.actor.userId ?? superAdmin?.id,
    actorUsername: input.actor.username,
    actorRole: input.actor.role,
    action: "HOSPITAL_CREATED",
    entity: "Hospital",
    entityId: hospital.id,
    summary: `${input.actor.username} registered hospital ${hospital.name} (${hospital.code}); invoice ${invoice.invoiceNo}.`,
    metadata: {
      hospitalCode: hospital.code,
      superAdmin: prepared.adminUsername,
      tierId: prepared.tierId,
      pharmacyEnabled: tier.pharmacyEnabled,
      labEnabled: tier.labEnabled,
      inventoryEnabled: tier.inventoryEnabled,
      invoiceNo: invoice.invoiceNo,
      total: prepared.quote.total,
      invoiceStatus,
      razorpaySubscriptionId: input.razorpaySubscriptionId ?? null,
    },
  });

  return { hospital, superAdmin, invoice, quote: prepared.quote };
}
