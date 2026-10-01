import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { suggestedUsername, uniqueUsername } from "@/lib/employee";
import { issueOtp } from "@/lib/otp";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";
import { signupSchema } from "@/lib/validation/auth";
import { parseJsonBody } from "@/lib/validation/parse";

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
    const parsed = await parseJsonBody(request, signupSchema);
    if (!parsed.ok) return parsed.response;
    const { mobile, password, role: requestedRole } = parsed.data;

    const existingMobile = await prisma.appUser.findFirst({
      where: { mobile },
    });
    if (existingMobile?.isVerified) {
      return NextResponse.json({ error: "Mobile number is already registered." }, { status: 409 });
    }

    // Unverified rows are pending OTP only — allow retry (new password/role + fresh OTP)
    // instead of locking the mobile after a failed/skipped verification.
    const passwordHash = await hashPassword(password);
    const user = existingMobile
      ? await prisma.appUser.update({
          where: { id: existingMobile.id },
          data: {
            passwordHash,
            role: requestedRole,
            isVerified: false,
          },
        })
      : await prisma.appUser.create({
          data: {
            username: await uniqueUsername(suggestedUsername("user", mobile.slice(-4), requestedRole)),
            mobile,
            passwordHash,
            isVerified: false,
            role: requestedRole,
          },
        });

    const otpResult = await issueOtp(user.id, user.mobile, "signup");
    if (!otpResult.delivered) {
      const detail = otpResult.error || "WhatsApp delivery failed.";
      const hint = /AskEva could not decrypt|API token/i.test(detail)
        ? " Fix ASKEVA_API_TOKEN on the server (full key, one line), recreate web, then try again."
        : " Check WHATSAPP_OTP_TEMPLATE=reminder is approved, then try again.";
      return NextResponse.json(
        {
          error: `Could not send OTP on WhatsApp. ${detail}${hint}`,
          mobile: user.mobile,
        },
        { status: 502 },
      );
    }

    await writeAuditLog({
      request,
      actorUserId: user.id,
      actorUsername: user.username,
      actorRole: user.role,
      action: existingMobile ? "USER_SIGNUP_OTP_RESENT" : "USER_REGISTERED",
      entity: "AppUser",
      entityId: user.id,
      summary: existingMobile
        ? `Mobile ${user.mobile} restarted signup OTP as ${user.role.replace(/_/g, " ")}.`
        : `Mobile ${user.mobile} started signup as ${user.role.replace(/_/g, " ")} and must verify OTP before login.`,
      metadata: { mobile: user.mobile, resumed: Boolean(existingMobile) },
    });

    return NextResponse.json({
      ok: true,
      mobile: user.mobile,
      message: "Enter the OTP sent to your WhatsApp to finish signup, then request to join a listed hospital.",
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
