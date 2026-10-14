import { NextResponse } from "next/server";
import { issueOtp, otpErrorMessage, verifyAndConsumeOtp } from "@/lib/otp";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";
import { actionOtpSchema } from "@/lib/validation/auth";
import { parseJsonBody } from "@/lib/validation/parse";

const SEND_COOLDOWN_MS = 60_000;

type OtpUser = {
  id: string;
  mobile: string;
  otpCode: string | null;
  otpExpiresAt: Date | null;
  otpAttempts: number;
};

export async function sendActionOtp(request: Request, user: Pick<OtpUser, "id" | "mobile">, purpose: string, rateSuffix: string) {
  const limited = checkRateLimit(`${clientKey(request, rateSuffix)}:${user.id}`, {
    limit: 1,
    windowMs: SEND_COOLDOWN_MS,
    lockMs: SEND_COOLDOWN_MS,
  });
  if (!limited.ok) {
    return NextResponse.json(
      {
        error: `Please wait ${limited.retryAfterSec} seconds before requesting another OTP.`,
        retryAfterSec: limited.retryAfterSec,
      },
      { status: 429 },
    );
  }

  const otpResult = await issueOtp(user.id, user.mobile, purpose);
  if (!otpResult.delivered) {
    return NextResponse.json({ error: otpResult.error || "Could not send OTP on WhatsApp." }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    message: "OTP sent on WhatsApp.",
    cooldownSec: 60,
  });
}

export async function consumeActionOtp(request: Request, user: OtpUser, purpose: string, rateSuffix: string) {
  const limited = checkRateLimit(`${clientKey(request, rateSuffix)}:${user.id}`, {
    limit: 20,
    windowMs: 15 * 60 * 1000,
    lockMs: 15 * 60 * 1000,
  });
  if (!limited.ok) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: `Too many attempts. Try again in ${limited.retryAfterSec} seconds.` },
        { status: 429 },
      ),
    };
  }

  const parsed = await parseJsonBody(request, actionOtpSchema);
  if (!parsed.ok) return { ok: false as const, response: parsed.response };

  const result = await verifyAndConsumeOtp(user, parsed.data.otp, purpose);
  if (!result.ok) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: otpErrorMessage(result.error) }, { status: 400 }),
    };
  }
  return { ok: true as const };
}
