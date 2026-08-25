import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession, homeForRole, SESSION_COOKIE, verifyPassword } from "@/lib/auth";
import { isValidIndianMobile, normalizeMobile } from "@/lib/phone";
import { writeAuditLog } from "@/lib/audit";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const mobile = normalizeMobile(String(body?.mobile ?? body?.identifier ?? ""));
  const password = String(body?.password ?? "");

  if (!isValidIndianMobile(mobile) || !password) {
    return NextResponse.json({ error: "Enter a valid 10-digit mobile number and password." }, { status: 400 });
  }

  const user = await prisma.appUser.findUnique({ where: { mobile } });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    await writeAuditLog({
      request,
      hospitalId: user?.hospitalId,
      actorUserId: user?.id,
      actorUsername: mobile,
      actorRole: user?.role,
      action: "LOGIN_FAILED",
      entity: "AppUser",
      entityId: user?.id,
      summary: `Failed login attempt for mobile ${mobile}.`,
    });
    return NextResponse.json({ error: "Invalid mobile number or password." }, { status: 401 });
  }

  if (!user.isVerified) {
    return NextResponse.json(
      { error: "Mobile is not verified yet.", needsOtp: true, mobile: user.mobile },
      { status: 403 },
    );
  }
  if (user.isActive === false) {
    return NextResponse.json({ error: "This account is inactive. Contact hospital admin." }, { status: 403 });
  }

  const sessionToken = await createSession(user.id);
  await writeAuditLog({
    request,
    hospitalId: user.hospitalId,
    actorUserId: user.id,
    actorUsername: user.username,
    actorRole: user.role,
    action: "LOGIN",
    entity: "AppUser",
    entityId: user.id,
    summary: `${user.username} signed in as ${user.role.replace(/_/g, " ")}.`,
  });

  const response = NextResponse.json({
    ok: true,
    username: user.username,
    mobile: user.mobile,
    role: user.role,
    sessionToken,
    redirectTo: homeForRole(user.role, user.hospitalId),
  });
  response.cookies.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
  return response;
}
