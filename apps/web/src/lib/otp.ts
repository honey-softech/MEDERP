import { createHash, randomInt, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";

export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;

export function hashOtp(otp: string) {
  return createHash("sha256").update(otp).digest("hex");
}

export function generateOtp() {
  return String(randomInt(100_000, 1_000_000));
}

/** Deliver OTP. Until an SMS provider is wired, logs server-side only (never in API responses). */
export function deliverOtp(mobile: string, otp: string, purpose: string) {
  console.info(`[otp] ${purpose} for ******${mobile.slice(-4)}: ${otp}`);
}

export async function issueOtp(userId: string, mobile: string, purpose: string) {
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  await prisma.appUser.update({
    where: { id: userId },
    data: {
      otpCode: hashOtp(otp),
      otpExpiresAt: expiresAt,
      otpAttempts: 0,
    },
  });
  deliverOtp(mobile, otp, purpose);
  return { expiresAt };
}

function safeEqualHex(a: string, b: string) {
  try {
    const left = Buffer.from(a, "hex");
    const right = Buffer.from(b, "hex");
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

export type OtpVerifyResult =
  | { ok: true }
  | { ok: false; error: "invalid" | "expired" | "locked" | "missing" };

/** Verifies OTP. On success clears it (single-use). */
export async function verifyAndConsumeOtp(
  user: { id: string; otpCode: string | null; otpExpiresAt: Date | null; otpAttempts: number },
  otp: string,
): Promise<OtpVerifyResult> {
  if (!user.otpCode || !user.otpExpiresAt) {
    return { ok: false, error: "missing" };
  }
  if (user.otpAttempts >= OTP_MAX_ATTEMPTS) {
    return { ok: false, error: "locked" };
  }
  if (user.otpExpiresAt.getTime() < Date.now()) {
    await prisma.appUser.update({
      where: { id: user.id },
      data: { otpCode: null, otpExpiresAt: null, otpAttempts: 0 },
    });
    return { ok: false, error: "expired" };
  }

  const match = safeEqualHex(user.otpCode, hashOtp(otp.trim()));
  if (!match) {
    const attempts = user.otpAttempts + 1;
    await prisma.appUser.update({
      where: { id: user.id },
      data: {
        otpAttempts: attempts,
        ...(attempts >= OTP_MAX_ATTEMPTS
          ? { otpCode: null, otpExpiresAt: null }
          : {}),
      },
    });
    return { ok: false, error: attempts >= OTP_MAX_ATTEMPTS ? "locked" : "invalid" };
  }

  await prisma.appUser.update({
    where: { id: user.id },
    data: { otpCode: null, otpExpiresAt: null, otpAttempts: 0 },
  });
  return { ok: true };
}

export function otpErrorMessage(error: Exclude<OtpVerifyResult, { ok: true }>["error"]) {
  switch (error) {
    case "expired":
      return "OTP has expired. Request a new one.";
    case "locked":
      return "Too many incorrect OTP attempts. Request a new one.";
    case "missing":
      return "No active OTP. Request a new one.";
    default:
      return "Invalid OTP.";
  }
}
