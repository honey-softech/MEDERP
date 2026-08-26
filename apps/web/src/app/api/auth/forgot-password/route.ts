import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidIndianMobile, normalizeMobile } from "@/lib/phone";
import { writeAuditLog } from "@/lib/audit";
import { issueOtp } from "@/lib/otp";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";

/** Uniform response — never reveal whether the mobile is registered. */
const OK_BODY = {
  ok: true,
  message: "If that mobile number is registered, an OTP has been sent.",
};

export async function POST(request: Request) {
  const limited = checkRateLimit(clientKey(request, "forgot-password"), {
    limit: 5,
    windowMs: 15 * 60 * 1000,
    lockMs: 30 * 60 * 1000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: `Too many reset requests. Try again in ${limited.retryAfterSec} seconds.` },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const mobile = normalizeMobile(String(body?.mobile ?? body?.identifier ?? ""));

  if (!isValidIndianMobile(mobile)) {
    return NextResponse.json({ error: "Enter the 10-digit mobile number registered on this account." }, { status: 400 });
  }

  const user = await prisma.appUser.findUnique({ where: { mobile } });

  if (user && user.isActive !== false) {
    await issueOtp(user.id, user.mobile, "password-reset");

    await writeAuditLog({
      request,
      hospitalId: user.hospitalId,
      actorUserId: user.id,
      actorUsername: user.username,
      actorRole: user.role,
      action: "PASSWORD_RESET_REQUESTED",
      entity: "AppUser",
      entityId: user.id,
      summary: `${user.username} requested a password reset.`,
    });
  }

  return NextResponse.json({ ...OK_BODY, mobile });
}
