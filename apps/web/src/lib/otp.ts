import { createHash, randomInt, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { deliverMessage } from "@/lib/messaging/providers";
import { enqueueMessage } from "@/lib/messaging/queue";
import { renderTemplate } from "@/lib/messaging/templates";

export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;

/** Temporary stand-in until SMS OTP is wired. Set OTP_DUMMY=0 to require a real issued code. */
export const DUMMY_OTP = "123456";

export function dummyOtpEnabled() {
  return process.env.OTP_DUMMY !== "0";
}

export function hashOtp(otp: string) {
  return createHash("sha256").update(otp).digest("hex");
}

export function generateOtp() {
  if (dummyOtpEnabled()) return DUMMY_OTP;
  return String(randomInt(100_000, 1_000_000));
}

/** Deliver OTP via the messaging queue when the user belongs to a hospital; otherwise send immediately. */
export async function deliverOtp(mobile: string, otp: string, purpose: string, hospitalId?: string | null) {
  const body = renderTemplate("otp", { otp });
  if (hospitalId) {
    const queued = await enqueueMessage({
      hospitalId,
      channel: "SMS",
      templateKey: "otp",
      variables: { otp, purpose },
      toPhone: mobile,
    });
    if ("error" in queued) {
      await deliverMessage({ toPhone: mobile, channel: "SMS", body, templateKey: "otp" });
    }
    return;
  }
  await deliverMessage({ toPhone: mobile, channel: "SMS", body, templateKey: "otp" });
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
  const user = await prisma.appUser.findUnique({
    where: { id: userId },
    select: { hospitalId: true },
  });
  await deliverOtp(mobile, otp, purpose, user?.hospitalId);
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

function isDummyOtp(otp: string) {
  return dummyOtpEnabled() && otp.trim() === DUMMY_OTP;
}

async function clearOtp(userId: string) {
  await prisma.appUser.update({
    where: { id: userId },
    data: { otpCode: null, otpExpiresAt: null, otpAttempts: 0 },
  });
}

/** Verifies OTP. On success clears it (single-use). Dummy 123456 is accepted until SMS is live. */
export async function verifyAndConsumeOtp(
  user: { id: string; otpCode: string | null; otpExpiresAt: Date | null; otpAttempts: number },
  otp: string,
): Promise<OtpVerifyResult> {
  if (isDummyOtp(otp)) {
    await clearOtp(user.id);
    return { ok: true };
  }

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

  await clearOtp(user.id);
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
