import type { AppRole, HospitalSubscriptionStatus, PaymentMethod } from "@prisma/client";
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
import { allocateHospitalUserIdentity, parseEmployeeBody, uniqueUsername, upsertAdminDoctorStaff } from "@/lib/employee";
import { seedHospitalDepartments } from "@/lib/front-desk";
import { seedHospitalWards } from "@/lib/wards";
import { calculateRegistrationTotal, createPlatformInvoice } from "@/lib/platform-billing";
import { upsertHospitalSubscription, unixToDate } from "@/lib/hospital-subscription";
import { hospitalFieldsFromTier, isSubscriptionTierId, type SubscriptionTierId } from "@/lib/subscription-tiers";
import { pricingFromSettings } from "@/lib/platform-pricing";

export class HospitalRegistrationError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export type AdminDoctorRegistrationProfile = {
  firstName?: string | null;
  lastName?: string | null;
  medicalRegNo: string;
  specialization: string;
  medicalDegree?: string | null;
  regCouncil?: string | null;
  postgraduate?: string | null;
  consultationFee?: string | number | null;
  followUpFee?: string | number | null;
  teleconsultEnabled?: boolean;
  emergencyDutyEnabled?: boolean;
};

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
  /** When true, no PlatformInvoice is created (trial / deferred card-auth). Bills only on real charge. */
  skipInvoice?: boolean;
  trialEndsAt?: Date | null;
  paymentMethod?: PaymentMethod | null;
  paymentNotes?: string | null;
  termsAccepted?: boolean;
  adminAsDoctor?: boolean;
  doctorProfile?: AdminDoctorRegistrationProfile | null;
  razorpayPlanId?: string | null;
  razorpaySubscriptionId?: string | null;
  razorpayPaymentId?: string | null;
  subscriptionStatus?: HospitalSubscriptionStatus | null;
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
  /** System username (unique, auto-allocated). Login uses mobile, not this. */
  adminUsername: string;
  /** Display name entered on the form (any text). */
  adminDisplayName: string;
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

/** Build an internal login handle — login itself uses mobile; username is storage-only. */
function usernameBaseFromAdmin(displayName: string, email: string, mobile: string) {
  const fromName = displayName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const fromEmail = email.split("@")[0]?.toLowerCase().replace(/[^a-z0-9]/g, "") || "";
  const base = (fromName || fromEmail || `admin${mobile.slice(-4)}`).slice(0, 40);
  return `${base}adm`.slice(0, 48);
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
  // Display name only — not used for login. Any text is fine; we mint a unique system username.
  const adminDisplayName = input.adminUsername.trim();
  const adminMobile = normalizeMobile(input.adminMobile);
  const adminEmail = normalizeEmail(String(input.adminEmail ?? ""));
  const adminPassword = input.adminPassword;
  const tierId = resolveTierId(input);

  if (!name) {
    throw new HospitalRegistrationError("Hospital name is required.", 400);
  }
  // Hospital names may repeat; uniqueness is via hospital code (auto-allocated) + hospital mobile.
  const hospitalPhoneError = mobileValidationError(phone, "Hospital mobile");
  if (hospitalPhoneError) {
    throw new HospitalRegistrationError(hospitalPhoneError, 400);
  }
  const adminMobileError = mobileValidationError(adminMobile, "Super admin mobile");
  if (adminMobileError) {
    throw new HospitalRegistrationError(adminMobileError, 400);
  }
  if (!isValidEmail(adminEmail)) {
    throw new HospitalRegistrationError("Enter a valid super admin email.", 400);
  }
  if (!adminDisplayName) {
    throw new HospitalRegistrationError("Super admin name is required.", 400);
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

  const mobileTaken = await prisma.appUser.findFirst({
    where: { mobile: adminMobile },
    select: { id: true },
  });
  if (mobileTaken) {
    throw new HospitalRegistrationError(
      "That super admin mobile number is already registered. Sign in with this number, or use another.",
      409,
    );
  }

  const emailTaken = await prisma.appUser.findFirst({
    where: { email: { equals: adminEmail, mode: "insensitive" } },
    select: { id: true },
  });
  if (emailTaken) {
    throw new HospitalRegistrationError(
      "That super admin email is already registered. Sign in, or use another email.",
      409,
    );
  }

  const adminUsername = await uniqueUsername(usernameBaseFromAdmin(adminDisplayName, adminEmail, adminMobile));

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
    adminDisplayName,
  };
}

export async function registerHospital(input: RegisterHospitalInput) {
  if (input.termsAccepted === false) {
    throw new HospitalRegistrationError("You must accept the Terms & Conditions to register.", 400);
  }

  if (input.adminAsDoctor) {
    const specialization = String(input.doctorProfile?.specialization ?? "").trim();
    const medicalRegNo = String(input.doctorProfile?.medicalRegNo ?? "").trim();
    if (!specialization) {
      throw new HospitalRegistrationError("Specialization is required when admin practices as a doctor.", 400);
    }
    if (!medicalRegNo) {
      throw new HospitalRegistrationError(
        "Medical registration number is required when admin practices as a doctor.",
        400,
      );
    }
  }

  const prepared = await prepareHospitalRegistration(input);
  const skipInvoice = Boolean(input.skipInvoice);
  const invoiceStatus = input.invoiceStatus ?? "ISSUED";
  const tier = prepared.quote.tier;

  const hospital = await prisma.hospital.create({
    data: {
      name: prepared.name,
      code: prepared.code,
      address: prepared.address,
      phone: prepared.phone,
      ...hospitalFieldsFromTier(tier),
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
    const nameParts = prepared.adminDisplayName.split(/\s+/).filter(Boolean);
    const firstName =
      String(input.doctorProfile?.firstName ?? "").trim() || nameParts[0] || prepared.adminDisplayName;
    const lastName =
      String(input.doctorProfile?.lastName ?? "").trim() || nameParts.slice(1).join(" ") || "";
    await prisma.appUser.update({
      where: { id: superAdmin.id },
      data: {
        ...identity,
        firstName,
        lastName: lastName || null,
        email: prepared.adminEmail,
      },
    });

    if (input.adminAsDoctor && input.doctorProfile) {
      const parsed = parseEmployeeBody(
        {
          firstName,
          lastName,
          mobile: prepared.adminMobile,
          email: prepared.adminEmail,
          username: prepared.adminUsername,
          medicalRegNo: input.doctorProfile.medicalRegNo,
          specialization: input.doctorProfile.specialization,
          medicalDegree: input.doctorProfile.medicalDegree,
          regCouncil: input.doctorProfile.regCouncil,
          postgraduate: input.doctorProfile.postgraduate,
          consultationFee: input.doctorProfile.consultationFee,
          followUpFee: input.doctorProfile.followUpFee,
          teleconsultEnabled: Boolean(input.doctorProfile.teleconsultEnabled),
          emergencyDutyEnabled: Boolean(input.doctorProfile.emergencyDutyEnabled),
          isActive: true,
        },
        "DOCTOR",
      );
      if ("error" in parsed) {
        throw new HospitalRegistrationError(parsed.error, 400);
      }
      const staff = await upsertAdminDoctorStaff({
        hospitalId: hospital.id,
        appUser: {
          id: superAdmin.id,
          username: prepared.adminUsername,
          mobile: prepared.adminMobile,
          email: prepared.adminEmail,
          firstName,
          lastName: lastName || null,
        },
        input: parsed.value,
        isActive: true,
      });
      await writeAuditLog({
        request: input.request,
        hospitalId: hospital.id,
        actorUserId: superAdmin.id,
        actorUsername: prepared.adminUsername,
        actorRole: "SUPER_ADMIN",
        action: "ADMIN_DOCTOR_ENABLED",
        entity: "Staff",
        entityId: staff.id,
        summary: `${prepared.adminDisplayName} enabled admin-as-doctor during hospital registration.`,
        metadata: {
          specialization: parsed.value.specialization,
          medicalRegNo: parsed.value.medicalRegNo,
        },
      });
    }
  }

  const invoice = skipInvoice
    ? null
    : await createPlatformInvoice({
        hospitalId: hospital.id,
        lines: prepared.quote.lines,
        total: prepared.quote.total,
        paymentMethod: input.paymentMethod ?? null,
        notes: input.paymentNotes ?? `Hospital registration — ${hospital.code} — ${tier.name}`,
        status: invoiceStatus,
        razorpayPaymentId: input.razorpayPaymentId ?? null,
        razorpaySubscriptionId: input.razorpaySubscriptionId ?? null,
      });

  if (input.razorpaySubscriptionId) {
    const planId = String(input.razorpayPlanId ?? "").trim();
    if (!planId) {
      throw new HospitalRegistrationError(
        "Razorpay plan id is missing after card link. Cannot save subscription.",
        400,
      );
    }
    await upsertHospitalSubscription({
      hospitalId: hospital.id,
      razorpayPlanId: planId,
      razorpaySubscriptionId: input.razorpaySubscriptionId,
      monthlyAmount: prepared.quote.total,
      status: input.subscriptionStatus ?? "AUTHENTICATED",
      termsAcceptedAt: new Date(),
      currentPeriodStart: unixToDate(input.subscriptionCurrentStart),
      currentPeriodEnd: unixToDate(input.subscriptionCurrentEnd),
      nextChargeAt: unixToDate(input.subscriptionChargeAt) ?? input.trialEndsAt ?? null,
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
    summary: invoice
      ? `${input.actor.username} registered hospital ${hospital.name} (${hospital.code}); invoice ${invoice.invoiceNo}.`
      : `${input.actor.username} registered hospital ${hospital.name} (${hospital.code}); no invoice (trial / deferred billing).`,
    metadata: {
      hospitalCode: hospital.code,
      superAdmin: prepared.adminUsername,
      tierId: prepared.tierId,
      pharmacyEnabled: false,
      labEnabled: false,
      inventoryEnabled: false,
      invoiceNo: invoice?.invoiceNo ?? null,
      total: prepared.quote.total,
      invoiceStatus: skipInvoice ? "SKIPPED" : invoiceStatus,
      razorpaySubscriptionId: input.razorpaySubscriptionId ?? null,
      adminAsDoctor: Boolean(input.adminAsDoctor),
    },
  });

  return { hospital, superAdmin, invoice, quote: prepared.quote };
}

/** Parse optional admin-as-doctor payload from a public registration request body. */
export function doctorProfileFromBody(body: Record<string, unknown> | null): {
  adminAsDoctor: boolean;
  doctorProfile: AdminDoctorRegistrationProfile | null;
} {
  const adminAsDoctor = Boolean(body?.adminAsDoctor);
  if (!adminAsDoctor) {
    return { adminAsDoctor: false, doctorProfile: null };
  }
  const profile = (body?.doctorProfile ?? body) as Record<string, unknown>;
  return {
    adminAsDoctor: true,
    doctorProfile: {
      firstName: profile.firstName != null ? String(profile.firstName) : null,
      lastName: profile.lastName != null ? String(profile.lastName) : null,
      medicalRegNo: String(profile.medicalRegNo ?? "").trim(),
      specialization: String(profile.specialization ?? "").trim(),
      medicalDegree: profile.medicalDegree != null ? String(profile.medicalDegree) : null,
      regCouncil: profile.regCouncil != null ? String(profile.regCouncil) : null,
      postgraduate: profile.postgraduate != null ? String(profile.postgraduate) : null,
      consultationFee: profile.consultationFee != null ? String(profile.consultationFee) : null,
      followUpFee: profile.followUpFee != null ? String(profile.followUpFee) : null,
      teleconsultEnabled: Boolean(profile.teleconsultEnabled),
      emergencyDutyEnabled: Boolean(profile.emergencyDutyEnabled),
    },
  };
}
