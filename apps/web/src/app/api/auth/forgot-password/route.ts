import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEFAULT_OTP } from "@/lib/auth";
import { isValidIndianMobile, normalizeMobile } from "@/lib/phone";
import { writeAuditLog } from "@/lib/audit";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const mobile = normalizeMobile(String(body?.mobile ?? body?.identifier ?? ""));

  if (!isValidIndianMobile(mobile)) {
    return NextResponse.json({ error: "Enter the 10-digit mobile number registered on this account." }, { status: 400 });
  }

  const user = await prisma.appUser.findUnique({ where: { mobile } });

  if (!user) {
    return NextResponse.json({ error: "No account found for this mobile number." }, { status: 404 });
  }
  if (user.isActive === false) {
    return NextResponse.json({ error: "This account is inactive. Contact hospital admin." }, { status: 403 });
  }

  await prisma.appUser.update({
    where: { id: user.id },
    data: { otpCode: DEFAULT_OTP },
  });

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

  return NextResponse.json({
    ok: true,
    mobile: user.mobile,
    message: "OTP sent. Use 1234 for now.",
  });
}
