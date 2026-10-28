import { randomBytes, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { normalizeMobile } from "@/lib/phone";
import {
  DUMMY_OTP,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MS,
  deliverOtp,
  dummyOtpEnabled,
  generateOtp,
  otpDigest,
  otpErrorMessage,
} from "@/lib/otp";

export const REGISTRATION_OTP_PURPOSE = "hospital-register";
export const REGISTRATION_PROOF_TTL_MS = 30 * 60 * 1000;

export class RegistrationMobileOtpError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

type ProofRow = {
  mobile: string;
  verifiedAt: Date | null;
  consumedAt: Date | null;
  proofExpiresAt: Date | null;
};

export function registrationProofProblem(row: ProofRow | null, mobile: string, now = Date.now()) {
  if (!row || !row.verifiedAt) return "missing" as const;
  if (row.mobile !== normalizeMobile(mobile)) return "mismatch" as const;
  if (row.consumedAt) return "used" as const;
  if (!row.proofExpiresAt || row.proofExpiresAt.getTime() < now) return "expired" as const;
  return null;
}

export function registrationProofError(problem: NonNullable<ReturnType<typeof registrationProofProblem>>) {
  if (problem === "mismatch") {
    return "WhatsApp verification does not match this admin number. Verify the admin WhatsApp number again.";
  }
  if (problem === "used") {
    return "This WhatsApp verification was already used. Verify the admin number again.";
  }
  if (problem === "expired") {
    return "WhatsApp verification has expired. Verify the admin number again.";
  }
  return "Verify the super admin WhatsApp number before registering the hospital.";
}

function hashesMatch(left: string, right: string) {
  try {
    const a = Buffer.from(left, "hex");
    const b = Buffer.from(right, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function isDummyOtp(otp: string) {
  return dummyOtpEnabled() && otp.trim() === DUMMY_OTP;
}

export async function sendRegistrationMobileOtp(mobile: string) {
  const normalized = normalizeMobile(mobile);
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  await prisma.registrationMobileOtp.updateMany({
    where: {
      mobile: normalized,
      purpose: REGISTRATION_OTP_PURPOSE,
      consumedAt: null,
      verifiedAt: null,
    },
    data: { expiresAt: new Date(0) },
  });
  await prisma.registrationMobileOtp.create({
    data: {
      mobile: normalized,
      purpose: REGISTRATION_OTP_PURPOSE,
      codeHash: otpDigest(otp, REGISTRATION_OTP_PURPOSE),
      expiresAt,
    },
  });
  const delivery = await deliverOtp(normalized, otp, REGISTRATION_OTP_PURPOSE);
  if (!delivery.ok) {
    throw new RegistrationMobileOtpError(
      delivery.error || "Could not send the OTP on WhatsApp. Use a WhatsApp number for the admin.",
      502,
    );
  }
  return { expiresAt };
}

export async function verifyRegistrationMobileOtp(mobile: string, otp: string) {
  const normalized = normalizeMobile(mobile);
  const code = otp.trim();
  const row = await prisma.registrationMobileOtp.findFirst({
    where: {
      mobile: normalized,
      purpose: REGISTRATION_OTP_PURPOSE,
      consumedAt: null,
      verifiedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!row) {
    throw new RegistrationMobileOtpError(otpErrorMessage("missing"), 400);
  }
  if (row.attempts >= OTP_MAX_ATTEMPTS) {
    throw new RegistrationMobileOtpError(otpErrorMessage("locked"), 400);
  }

  const match = isDummyOtp(code) || hashesMatch(row.codeHash, otpDigest(code, REGISTRATION_OTP_PURPOSE));
  if (!match) {
    const attempts = row.attempts + 1;
    await prisma.registrationMobileOtp.update({
      where: { id: row.id },
      data: {
        attempts,
        ...(attempts >= OTP_MAX_ATTEMPTS ? { expiresAt: new Date(0) } : {}),
      },
    });
    throw new RegistrationMobileOtpError(
      otpErrorMessage(attempts >= OTP_MAX_ATTEMPTS ? "locked" : "invalid"),
      400,
    );
  }

  const proofToken = randomBytes(32).toString("hex");
  const proofExpiresAt = new Date(Date.now() + REGISTRATION_PROOF_TTL_MS);
  await prisma.registrationMobileOtp.update({
    where: { id: row.id },
    data: { verifiedAt: new Date(), proofToken, proofExpiresAt },
  });
  return { proof: proofToken, mobile: normalized, proofExpiresAt };
}

export async function assertRegistrationMobileProof(mobile: string, proof: string | null | undefined) {
  const token = String(proof ?? "").trim();
  if (!token) {
    throw new RegistrationMobileOtpError(registrationProofError("missing"), 400);
  }
  const row = await prisma.registrationMobileOtp.findUnique({
    where: { proofToken: token },
    select: { mobile: true, verifiedAt: true, consumedAt: true, proofExpiresAt: true },
  });
  const problem = registrationProofProblem(row, mobile);
  if (problem) {
    throw new RegistrationMobileOtpError(registrationProofError(problem), 400);
  }
}

export async function consumeRegistrationMobileProof(mobile: string, proof: string | null | undefined) {
  const token = String(proof ?? "").trim();
  const normalized = normalizeMobile(mobile);
  const updated = await prisma.registrationMobileOtp.updateMany({
    where: {
      proofToken: token,
      mobile: normalized,
      consumedAt: null,
      verifiedAt: { not: null },
      proofExpiresAt: { gt: new Date() },
    },
    data: { consumedAt: new Date() },
  });
  if (updated.count !== 1) {
    throw new RegistrationMobileOtpError(
      "WhatsApp verification expired or was already used. Verify the admin number again.",
      400,
    );
  }
}
