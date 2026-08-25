import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeMobile } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const mobile = normalizeMobile(String(body?.mobile ?? ""));
  const otp = String(body?.otp ?? "").trim();

  if (!mobile || !otp) {
    return NextResponse.json({ error: "Mobile number and OTP are required." }, { status: 400 });
  }

  const user = await prisma.appUser.findUnique({ where: { mobile } });
  if (!user) {
    return NextResponse.json({ error: "No account found for this mobile number." }, { status: 404 });
  }

  if (user.otpCode !== otp) {
    return NextResponse.json({ error: "Invalid OTP." }, { status: 400 });
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
