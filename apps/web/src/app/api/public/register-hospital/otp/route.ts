import { NextResponse } from "next/server";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";
import { mobileValidationError, normalizeMobile } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { mobileCanBeRecreated } from "@/lib/reusable-mobile";
import { RegistrationMobileOtpError, sendRegistrationMobileOtp } from "@/lib/registration-mobile-otp";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { mobile?: unknown } | null;
  const mobile = normalizeMobile(String(body?.mobile ?? ""));
  const mobileError = mobileValidationError(mobile, "Super admin mobile");
  if (mobileError) {
    return NextResponse.json({ error: mobileError }, { status: 400 });
  }

  const limited = checkRateLimit(`${clientKey(request, "register-hospital-otp")}:${mobile}`, {
    limit: 1,
    windowMs: 60_000,
    lockMs: 60_000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: `Please wait ${limited.retryAfterSec} seconds before requesting another OTP.`, retryAfterSec: limited.retryAfterSec },
      { status: 429 },
    );
  }

  const owner = await prisma.appUser.findFirst({
    where: { mobile },
    select: { isActive: true, hospitalId: true, hospital: { select: { isActive: true } } },
  });
  if (
    owner &&
    !mobileCanBeRecreated({
      isActive: owner.isActive,
      hospitalId: owner.hospitalId,
      hospitalIsActive: owner.hospital?.isActive ?? null,
    })
  ) {
    return NextResponse.json(
      { error: "That super admin mobile is already registered. Sign in with this number, or use another WhatsApp number." },
      { status: 409 },
    );
  }

  try {
    await sendRegistrationMobileOtp(mobile);
    return NextResponse.json({
      ok: true,
      message: "OTP sent on WhatsApp to the admin number.",
      cooldownSec: 60,
    });
  } catch (error) {
    if (error instanceof RegistrationMobileOtpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Failed to send hospital registration OTP", error);
    return NextResponse.json({ error: "Could not send the OTP on WhatsApp." }, { status: 500 });
  }
}
