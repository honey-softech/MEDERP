import { createHash } from "crypto";

/** Purposes whose stored hash includes the action, so one WhatsApp code cannot confirm another. */
export const BOUND_OTP_PURPOSES = ["close-hospital", "leave-hospital", "delete-account"] as const;

export type BoundOtpPurpose = (typeof BOUND_OTP_PURPOSES)[number];

export function isBoundOtpPurpose(purpose: string): purpose is BoundOtpPurpose {
  return (BOUND_OTP_PURPOSES as readonly string[]).includes(purpose);
}

export function hashOtp(otp: string) {
  return createHash("sha256").update(otp).digest("hex");
}

/** Signup and password-reset stay a hash of the digits. Destructive actions hash `purpose:otp`. */
export function otpDigest(otp: string, purpose?: string | null) {
  const code = otp.trim();
  if (purpose && isBoundOtpPurpose(purpose)) return hashOtp(`${purpose}:${code}`);
  return hashOtp(code);
}
