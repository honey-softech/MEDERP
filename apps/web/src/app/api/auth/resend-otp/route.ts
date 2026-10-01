import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { resendOtpSchema } from "@/lib/validation/auth";
import { parseJsonBody } from "@/lib/validation/parse";
import { issueOtp } from "@/lib/otp";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";

const RESEND_COOLDOWN_MS = 60_000;

export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, resendOtpSchema);
  if (!parsed.ok) return parsed.response;
  const { mobile } = parsed.data;

  const limited = checkRateLimit(`${clientKey(request, "resend-otp")}:${mobile}`, {
    limit: 1,
    windowMs: RESEND_COOLDOWN_MS,
    lockMs: RESEND_COOLDOWN_MS,
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

  const user = await prisma.appUser.findUnique({ where: { mobile } });
  if (!user) {
    return NextResponse.json({ error: "No account found for this mobile number." }, { status: 404 });
  }
  if (user.isVerified) {
    return NextResponse.json({ error: "This mobile is already verified. Sign in with your password." }, { status: 400 });
  }
  if (user.isActive === false) {
    return NextResponse.json({ error: "This account is inactive. Contact hospital admin." }, { status: 403 });
  }

  const otpResult = await issueOtp(user.id, user.mobile, "signup");
  if (!otpResult.delivered) {
    return NextResponse.json(
      { error: otpResult.error || "Could not send OTP on WhatsApp." },
      { status: 502 },
    );
  }

  await writeAuditLog({
    request,
    hospitalId: user.hospitalId,
    actorUserId: user.id,
    actorUsername: user.username,
    actorRole: user.role,
    action: "USER_SIGNUP_OTP_RESENT",
    entity: "AppUser",
    entityId: user.id,
    summary: `${user.username} requested another signup OTP.`,
  });

  return NextResponse.json({
    ok: true,
    mobile: user.mobile,
    message: "OTP sent on WhatsApp.",
    cooldownSec: 60,
  });
}
