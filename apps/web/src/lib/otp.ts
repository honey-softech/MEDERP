import { createHash, randomInt, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { deliverMessage, messagingProvider } from "@/lib/messaging/providers";
import { renderTemplate } from "@/lib/messaging/templates";

export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;

/** Local-dev only. On production with WhatsApp configured this is off unless OTP_DUMMY=1. */
export const DUMMY_OTP = "123456";

/**
 * Dummy OTP (123456):
 * - OTP_DUMMY=1 → always allow (forced test mode)
 * - OTP_DUMMY=0 → never allow
 * - unset → allow only when WhatsApp / AskEva is NOT configured (local console mode)
 */
export function dummyOtpEnabled() {
  const flag = (process.env.OTP_DUMMY ?? "").trim();
  if (flag === "1") return true;
  if (flag === "0") return false;
  return messagingProvider() !== "whatsapp";
}

export function hashOtp(otp: string) {
  return createHash("sha256").update(otp).digest("hex");
}

export function generateOtp() {
  if (dummyOtpEnabled() && messagingProvider() !== "whatsapp") return DUMMY_OTP;
  return String(randomInt(100_000, 1_000_000));
}

/** Deliver OTP on WhatsApp immediately (do not wait for the outbound queue). */
export async function deliverOtp(mobile: string, otp: string, purpose: string, _hospitalId?: string | null) {
  const body = renderTemplate("otp", { otp, number: otp });
  const result = await deliverMessage({
    toPhone: mobile,
    channel: "WHATSAPP",
    body,
    templateKey: "otp",
    otp,
    variables: { otp, number: otp, purpose },
  });
  if (!result.ok) {
    console.error(`[otp] WhatsApp send failed for ******${mobile.slice(-4)} (${purpose}): ${result.error}`);
  } else if (messagingProvider() === "console") {
    console.warn(
      `[otp] WhatsApp not configured (set ASKEVA_API_TOKEN). Logged OTP for ******${mobile.slice(-4)}.`,
    );
  }
  return result;
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
  const delivery = await deliverOtp(mobile, otp, purpose, user?.hospitalId);
  if (!delivery.ok && messagingProvider() === "whatsapp") {
    return {
      expiresAt,
      delivered: false as const,
      error: delivery.error || "Could not send OTP on WhatsApp.",
    };
  }
  return { expiresAt, delivered: true as const };
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

/** Verifies OTP. On success clears it (single-use). Dummy 123456 only when dummyOtpEnabled(). */
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
