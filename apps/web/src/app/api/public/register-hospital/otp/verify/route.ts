import { NextResponse } from "next/server";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";
import { mobileValidationError, normalizeMobile } from "@/lib/phone";
import { RegistrationMobileOtpError, verifyRegistrationMobileOtp } from "@/lib/registration-mobile-otp";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { mobile?: unknown; otp?: unknown } | null;
  const mobile = normalizeMobile(String(body?.mobile ?? ""));
  const otp = String(body?.otp ?? "").trim();
  const mobileError = mobileValidationError(mobile, "Super admin mobile");
  if (mobileError) {
    return NextResponse.json({ error: mobileError }, { status: 400 });
  }
  if (!/^\d{6}$/.test(otp)) {
    return NextResponse.json({ error: "Enter the 6-digit OTP sent on WhatsApp." }, { status: 400 });
  }

  const limited = checkRateLimit(`${clientKey(request, "register-hospital-otp-verify")}:${mobile}`, {
    limit: 20,
    windowMs: 15 * 60 * 1000,
    lockMs: 15 * 60 * 1000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${limited.retryAfterSec} seconds.` },
      { status: 429 },
    );
  }

  try {
    const verified = await verifyRegistrationMobileOtp(mobile, otp);
    return NextResponse.json({
      ok: true,
      proof: verified.proof,
      mobile: verified.mobile,
      message: "Admin WhatsApp number verified.",
    });
  } catch (error) {
    if (error instanceof RegistrationMobileOtpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Failed to verify hospital registration OTP", error);
    return NextResponse.json({ error: "Could not verify the OTP." }, { status: 500 });
  }
}
