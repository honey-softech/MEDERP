import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { STAFF_ROLES, hashPassword, passwordValidationError } from "@/lib/auth";
import { isValidIndianMobile, normalizeMobile } from "@/lib/phone";
import { writeAuditLog } from "@/lib/audit";
import { issueOtp } from "@/lib/otp";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";
import type { AppRole } from "@prisma/client";

export async function POST(request: Request) {
  const limited = checkRateLimit(clientKey(request, "signup"), {
    limit: 8,
    windowMs: 60 * 60 * 1000,
    lockMs: 60 * 60 * 1000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: `Too many signup attempts. Try again in ${limited.retryAfterSec} seconds.` },
      { status: 429 },
    );
  }

  try {
    const body = await request.json().catch(() => null);
    const username = String(body?.username ?? "").trim();
    const mobile = normalizeMobile(String(body?.mobile ?? ""));
    const password = String(body?.password ?? "");
    const requestedRole = String(body?.role ?? "RECEPTIONIST") as AppRole;

    if (username.length < 3) {
      return NextResponse.json({ error: "Username must be at least 3 characters." }, { status: 400 });
    }
    if (!/^[a-zA-Z0-9._]+$/.test(username)) {
      return NextResponse.json(
        { error: "Username can only contain letters, numbers, dots, and underscores." },
        { status: 400 },
      );
    }
    if (!isValidIndianMobile(mobile)) {
      return NextResponse.json({ error: "Enter a valid 10-digit mobile number." }, { status: 400 });
    }
    const passwordError = passwordValidationError(password);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }
    if (!STAFF_ROLES.includes(requestedRole)) {
      return NextResponse.json({ error: "Select a valid hospital role." }, { status: 400 });
    }

    const existing = await prisma.appUser.findFirst({
      where: { OR: [{ username }, { mobile }] },
    });
    if (existing) {
      return NextResponse.json({ error: "Username or mobile number is already registered." }, { status: 409 });
    }

    const user = await prisma.appUser.create({
      data: {
        username,
        mobile,
        passwordHash: await hashPassword(password),
        isVerified: false,
        role: requestedRole,
      },
    });

    await issueOtp(user.id, user.mobile, "signup");

    await writeAuditLog({
      request,
      actorUserId: user.id,
      actorUsername: user.username,
      actorRole: user.role,
      action: "USER_REGISTERED",
      entity: "AppUser",
      entityId: user.id,
      summary: `${user.username} registered as ${user.role.replace(/_/g, " ")} and must request to join a listed hospital.`,
      metadata: { mobile: user.mobile },
    });

    return NextResponse.json({
      ok: true,
      mobile: user.mobile,
      message: "Account created. Enter the OTP sent to your mobile to verify, then request to join a listed hospital.",
    });
  } catch (error) {
    console.error("Signup failed", error);
    const message = error instanceof Error ? error.message : "Signup failed.";
    return NextResponse.json(
      {
        error: message.includes("Can't reach database") || message.includes("P1001")
          ? "Database is unreachable. Check DATABASE_URL on Railway."
          : message.includes("does not exist") || message.includes("P2021")
            ? "Database tables are missing. Redeploy so migrations can run."
            : "Could not create account. Please try again.",
      },
      { status: 500 },
    );
  }
}
