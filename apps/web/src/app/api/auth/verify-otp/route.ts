import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeMobile } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { otpErrorMessage, verifyAndConsumeOtp } from "@/lib/otp";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";

const GENERIC_OTP_ERROR = "Invalid or expired OTP.";

export async function POST(request: Request) {
  const limited = checkRateLimit(clientKey(request, "verify-otp"), {
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

  const body = await request.json().catch(() => null);
  const mobile = normalizeMobile(String(body?.mobile ?? ""));
  const otp = String(body?.otp ?? "").trim();

  if (!mobile || !otp) {
    return NextResponse.json({ error: "Mobile number and OTP are required." }, { status: 400 });
  }

  const user = await prisma.appUser.findUnique({ where: { mobile } });
  if (!user) {
    return NextResponse.json({ error: GENERIC_OTP_ERROR }, { status: 400 });
  }

  const result = await verifyAndConsumeOtp(user, otp);
  if (!result.ok) {
    return NextResponse.json({ error: otpErrorMessage(result.error) }, { status: 400 });
  }

  await prisma.appUser.update({
    where: { id: user.id },
    data: { isVerified: true },
  });

  await writeAuditLog({
    request,
    hospitalId: user.hospitalId,
    actorUserId: user.id,
    actorUsername: user.username,
    actorRole: user.role,
    action: "OTP_VERIFIED",
    entity: "AppUser",
    entityId: user.id,
    summary: `${user.username} verified mobile OTP.`,
  });

  return NextResponse.json({ ok: true });
}
