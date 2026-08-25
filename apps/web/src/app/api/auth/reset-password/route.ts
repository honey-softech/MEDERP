import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, normalizeMobile } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const mobile = normalizeMobile(String(body?.mobile ?? ""));
  const otp = String(body?.otp ?? "").trim();
  const password = String(body?.password ?? "");

  if (!mobile || !otp) {
    return NextResponse.json({ error: "Mobile number and OTP are required." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }

  const user = await prisma.appUser.findUnique({ where: { mobile } });
  if (!user) {
    return NextResponse.json({ error: "No account found for this mobile number." }, { status: 404 });
  }
  if (user.isActive === false) {
    return NextResponse.json({ error: "This account is inactive. Contact hospital admin." }, { status: 403 });
  }
  if (user.otpCode !== otp) {
    return NextResponse.json({ error: "Invalid OTP." }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.appUser.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(password),
        isVerified: true,
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
