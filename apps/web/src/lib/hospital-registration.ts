import type { AppRole, HospitalSubscriptionStatus, PaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { hashPassword, normalizeHospitalCode, normalizeMobile } from "@/lib/auth";
import { passwordValidationError, superAdminNameError } from "@/lib/password-policy";
import {
  HOSPITAL_CODE_LENGTH,
  isCanonicalHospitalCode,
  isValidHospitalCode,
  slugFromHospitalName,
} from "@/lib/hospital-code";
import { mobileValidationError } from "@/lib/phone";
import { allocateHospitalUserIdentity, parseEmployeeBody, uniqueUsername, upsertAdminDoctorStaff } from "@/lib/employee";
import { ensureDepartmentByName, seedHospitalDepartments } from "@/lib/front-desk";
import { seedHospitalWards } from "@/lib/wards";
import { calculateRegistrationTotal, createPlatformInvoice } from "@/lib/platform-billing";
import { upsertHospitalSubscription, unixToDate } from "@/lib/hospital-subscription";
import { hospitalFieldsFromTier, isSubscriptionTierId, parseExtraUserCount, requireSubscriptionTier, type SubscriptionTierId } from "@/lib/subscription-tiers";
import { pricingFromSettings } from "@/lib/platform-pricing";
import { mobileCanBeRecreated } from "@/lib/reusable-mobile";
import {
  createReferralFromCode,
  findReferrerByCode,
  MAX_REFERRALS_PER_HOSPITAL,
  openReferralCount,
} from "@/lib/hospital-referrals";
import {
  assertRegistrationMobileProof,
  consumeRegistrationMobileProof,
  RegistrationMobileOtpError,
} from "@/lib/registration-mobile-otp";

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
  departmentName?: string | null;
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
  /** Proof from WhatsApp OTP on the super admin mobile. Required before the hospital is created. */
  mobileProof?: string | null;
  adminEmail?: string | null;
  adminPassword: string;
  tierId?: string;
  /** Logins beyond the selected plan's included users. ₹300/month each before GST. */
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
  /** Optional code of the clinic that referred this hospital. */
  referralCode?: string | null;
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
  referrerHospitalId: string | null;
  referrerHospitalName: string | null;
  referralCode: string | null;
  /** Existing login freed by a closed hospital or deleted membership. Reused instead of inserting a second row. */
  reuseUserId: string | null;
  /** Another freed login still holding this email. Cleared before the new hospital admin takes it. */
  releaseEmailUserId: string | null;
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
  try {
    await assertRegistrationMobileProof(adminMobile, input.mobileProof);
  } catch (error) {
    if (error instanceof RegistrationMobileOtpError) {
      throw new HospitalRegistrationError(error.message, error.status);
    }
    throw error;
  }
  if (!isValidEmail(adminEmail)) {
    throw new HospitalRegistrationError("Enter a valid super admin email.", 400);
  }
  const adminNameError = superAdminNameError(adminDisplayName);
  if (adminNameError) {
    throw new HospitalRegistrationError(adminNameError, 400);
  }
  const passwordError = passwordValidationError(adminPassword);
  if (passwordError) {
    throw new HospitalRegistrationError(passwordError, 400);
  }
  assertAdminPracticesAsDoctor(input);

  const code = await allocateUniqueHospitalCode(name, input.code);

  const phoneTaken = await prisma.hospital.findFirst({
    where: { phone, isActive: true, removedAt: null },
  });
  if (phoneTaken) {
    throw new HospitalRegistrationError("That hospital mobile number is already registered.", 409);
  }

  const mobileOwner = await prisma.appUser.findFirst({
    where: { mobile: adminMobile },
    select: { id: true, isActive: true, hospitalId: true, hospital: { select: { isActive: true } } },
  });
  const reuseUserId =
    mobileOwner &&
    mobileCanBeRecreated({
      isActive: mobileOwner.isActive,
      hospitalId: mobileOwner.hospitalId,
      hospitalIsActive: mobileOwner.hospital?.isActive ?? null,
    })
      ? mobileOwner.id
      : null;
  if (mobileOwner && !reuseUserId) {
    throw new HospitalRegistrationError(
      "That super admin mobile number is already registered. Sign in with this number, or use another.",
      409,
    );
  }

  const emailOwner = await prisma.appUser.findFirst({
    where: { email: { equals: adminEmail, mode: "insensitive" } },
    select: { id: true, isActive: true, hospitalId: true, hospital: { select: { isActive: true } } },
  });
  const emailFree =
    !emailOwner ||
    emailOwner.id === reuseUserId ||
    mobileCanBeRecreated({
      isActive: emailOwner.isActive,
      hospitalId: emailOwner.hospitalId,
      hospitalIsActive: emailOwner.hospital?.isActive ?? null,
    });
  if (!emailFree) {
    throw new HospitalRegistrationError(
      "That super admin email is already registered. Sign in, or use another email.",
      409,
    );
  }
  const releaseEmailUserId = emailOwner && emailOwner.id !== reuseUserId ? emailOwner.id : null;

  const adminUsername = await uniqueUsername(usernameBaseFromAdmin(adminDisplayName, adminEmail, adminMobile));

  const explicitTier = Boolean(input.tierId && isSubscriptionTierId(input.tierId));
  let extraUsers = 0;
  if (explicitTier) {
    try {
      extraUsers = parseExtraUserCount(input.extraStaffSlots ?? 0);
    } catch (error) {
      throw new HospitalRegistrationError(
        error instanceof Error ? error.message : "Invalid extra users.",
        400,
      );
    }
    if (requireSubscriptionTier(tierId).seatLimit == null && extraUsers > 0) {
      throw new HospitalRegistrationError("This plan includes unlimited users.", 400);
    }
  }
  const quote = await calculateRegistrationTotal({ tierId, extraUsers });

  if (!(quote.total > 0)) {
    throw new HospitalRegistrationError("Registration total must be greater than zero.", 400);
  }

  let referrerHospitalId: string | null = null;
  let referrerHospitalName: string | null = null;
  let referralCode: string | null = null;
  const rawReferralCode = String(input.referralCode ?? "").trim();
  if (rawReferralCode) {
    const referrer = await findReferrerByCode(rawReferralCode);
    if (!referrer) {
      throw new HospitalRegistrationError("Referral code not recognised.", 400);
    }
    const open = await openReferralCount(referrer.id);
    if (open >= MAX_REFERRALS_PER_HOSPITAL) {
      throw new HospitalRegistrationError("That clinic has already reached the referral limit.", 400);
    }
    referrerHospitalId = referrer.id;
    referrerHospitalName = referrer.name;
    referralCode = referrer.code;
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
    referrerHospitalId,
    referrerHospitalName,
    referralCode,
    reuseUserId,
    releaseEmailUserId,
  };
}

export async function registerHospital(input: RegisterHospitalInput) {
  if (input.termsAccepted === false) {
    throw new HospitalRegistrationError("You must accept the Terms & Conditions to register.", 400);
  }

  const prepared = await prepareHospitalRegistration(input);
  try {
    await consumeRegistrationMobileProof(prepared.adminMobile, input.mobileProof);
  } catch (error) {
    if (error instanceof RegistrationMobileOtpError) {
      throw new HospitalRegistrationError(error.message, error.status);
    }
    throw error;
  }
  const skipInvoice = Boolean(input.skipInvoice);
  const invoiceStatus = input.invoiceStatus ?? "ISSUED";
  const tier = prepared.quote.tier;
  const passwordHash = await hashPassword(prepared.adminPassword);

  if (prepared.releaseEmailUserId) {
    await prisma.appUser.update({
      where: { id: prepared.releaseEmailUserId },
      data: { email: null },
    });
  }

  const hospital = await prisma.hospital.create({
    data: {
      name: prepared.name,
      code: prepared.code,
      address: prepared.address,
      phone: prepared.phone,
      ...hospitalFieldsFromTier(tier),
      extraStaffSlots: prepared.quote.extraUsers,
      trialEndsAt: input.trialEndsAt ?? null,
      ...(prepared.reuseUserId
        ? {}
        : {
            users: {
              create: {
                username: prepared.adminUsername,
                mobile: prepared.adminMobile,
                email: prepared.adminEmail,
                passwordHash,
                isVerified: true,
                role: "SUPER_ADMIN" as const,
              },
            },
          }),
    },
    include: {
      users: {
        where: { role: "SUPER_ADMIN" },
        select: { id: true, username: true, mobile: true, email: true, role: true },
      },
    },
  });

  if (prepared.reuseUserId) {
    await prisma.devicePushToken.deleteMany({ where: { userId: prepared.reuseUserId } });
    await prisma.appSession.deleteMany({ where: { userId: prepared.reuseUserId } });
    const previousStaff = await prisma.staff.findUnique({ where: { appUserId: prepared.reuseUserId } });
    if (previousStaff) {
      await prisma.staff.update({
        where: { id: previousStaff.id },
        data: { appUserId: null, isActive: false },
      });
    }
    await prisma.appUser.update({
      where: { id: prepared.reuseUserId },
      data: {
        hospitalId: hospital.id,
        username: prepared.adminUsername,
        mobile: prepared.adminMobile,
        email: prepared.adminEmail,
        passwordHash,
        isVerified: true,
        isActive: true,
        role: "SUPER_ADMIN",
        userCode: null,
        employeeId: null,
        otpCode: null,
        otpExpiresAt: null,
        otpAttempts: 0,
      },
    });
    hospital.users = [
      {
        id: prepared.reuseUserId,
        username: prepared.adminUsername,
        mobile: prepared.adminMobile,
        email: prepared.adminEmail,
        role: "SUPER_ADMIN",
      },
    ];
  }

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
      const department = await ensureDepartmentByName(
        hospital.id,
        String(input.doctorProfile.departmentName ?? "").trim(),
      );
      const parsed = parseEmployeeBody(
        {
          firstName,
          lastName,
          mobile: prepared.adminMobile,
          email: prepared.adminEmail,
          username: prepared.adminUsername,
          departmentId: department?.id,
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

  if (prepared.referrerHospitalId && prepared.referralCode && prepared.referrerHospitalName) {
    await createReferralFromCode({
      referrerHospitalId: prepared.referrerHospitalId,
      referredHospitalId: hospital.id,
      referralCode: prepared.referralCode,
      referredHospitalName: hospital.name,
      referrerHospitalName: prepared.referrerHospitalName,
      request: input.request,
      actor: {
        userId: input.actor.userId ?? superAdmin?.id,
        username: input.actor.username,
        role: input.actor.role,
      },
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

function assertAdminPracticesAsDoctor(input: {
  adminAsDoctor?: boolean;
  doctorProfile?: AdminDoctorRegistrationProfile | null;
}) {
  if (!input.adminAsDoctor) return;
  const specialization = String(input.doctorProfile?.specialization ?? "").trim();
  const departmentName = String(input.doctorProfile?.departmentName ?? "").trim();
  const medicalRegNo = String(input.doctorProfile?.medicalRegNo ?? "").trim();
  if (!specialization) {
    throw new HospitalRegistrationError("Specialty is required when admin practices as a doctor.", 400);
  }
  if (!departmentName) {
    throw new HospitalRegistrationError("Department is required when admin practices as a doctor.", 400);
  }
  if (!medicalRegNo) {
    throw new HospitalRegistrationError(
      "Medical registration number is required when admin practices as a doctor.",
      400,
    );
  }
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
  const specialization = String(profile.specialization ?? "").trim();
  const departmentName = String(profile.departmentName ?? "").trim() || specialization;
  return {
    adminAsDoctor: true,
    doctorProfile: {
      firstName: profile.firstName != null ? String(profile.firstName) : null,
      lastName: profile.lastName != null ? String(profile.lastName) : null,
      medicalRegNo: String(profile.medicalRegNo ?? "").trim(),
      specialization,
      departmentName,
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
