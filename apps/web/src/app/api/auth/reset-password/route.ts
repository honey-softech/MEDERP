import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { resetPasswordSchema } from "@/lib/validation/auth";
import { parseJsonBody } from "@/lib/validation/parse";
import { otpErrorMessage, verifyAndConsumeOtp } from "@/lib/otp";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const limited = checkRateLimit(clientKey(request, "reset-password"), {
    limit: 10,
    windowMs: 15 * 60 * 1000,
    lockMs: 15 * 60 * 1000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${limited.retryAfterSec} seconds.` },
      { status: 429 },
    );
  }

  const parsed = await parseJsonBody(request, resetPasswordSchema);
  if (!parsed.ok) return parsed.response;
  const { mobile, otp, password } = parsed.data;

  const user = await prisma.appUser.findUnique({ where: { mobile } });
  if (!user || user.isActive === false) {
    return NextResponse.json({ error: "Invalid or expired OTP." }, { status: 400 });
  }

  const result = await verifyAndConsumeOtp(user, otp);
  if (!result.ok) {
    return NextResponse.json({ error: otpErrorMessage(result.error) }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.appUser.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(password),
        isVerified: true,
        otpCode: null,
        otpExpiresAt: null,
        otpAttempts: 0,
      },
    }),
    prisma.appSession.deleteMany({ where: { userId: user.id } }),
  ]);

  await writeAuditLog({
    request,
    hospitalId: user.hospitalId,
    actorUserId: user.id,
    actorUsername: user.username,
    actorRole: user.role,
    action: "PASSWORD_RESET",
    entity: "AppUser",
    entityId: user.id,
    summary: `${user.username} reset their password.`,
  });

  return NextResponse.json({ ok: true });
}
