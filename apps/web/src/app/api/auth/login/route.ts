import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createSession,
  DUMMY_PASSWORD_HASH,
  homeForRole,
  SESSION_COOKIE,
  sessionCookieOptions,
  verifyPassword,
} from "@/lib/auth";
import { isValidIndianMobile, normalizeMobile } from "@/lib/phone";
import { writeAuditLog } from "@/lib/audit";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const limited = checkRateLimit(clientKey(request, "login"), {
    limit: 10,
    windowMs: 15 * 60 * 1000,
    lockMs: 15 * 60 * 1000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: `Too many login attempts. Try again in ${limited.retryAfterSec} seconds.` },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const mobile = normalizeMobile(String(body?.mobile ?? body?.identifier ?? ""));
  const password = String(body?.password ?? "");

  if (!isValidIndianMobile(mobile) || !password) {
    return NextResponse.json({ error: "Enter a valid 10-digit mobile number and password." }, { status: 400 });
  }

  const user = await prisma.appUser.findUnique({
    where: { mobile },
    include: { hospital: { select: { isActive: true } } },
  });
  // Always run bcrypt when user missing to reduce timing enumeration.
  const passwordOk = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);

  if (!user || !passwordOk) {
    void writeAuditLog({
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

  if (user.hospitalId && user.hospital && user.hospital.isActive === false) {
    return NextResponse.json(
      { error: "This hospital's access has been stopped. Contact MedERP support." },
      { status: 403 },
    );
  }

  const session = await createSession(user.id, { setCookie: false });
  void writeAuditLog({
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
    sessionToken: session.token,
    redirectTo: homeForRole(user.role, user.hospitalId),
  });
  response.cookies.set(SESSION_COOKIE, session.token, sessionCookieOptions(session.expiresAt));
  return response;
}
