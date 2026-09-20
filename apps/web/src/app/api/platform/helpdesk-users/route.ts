import { NextResponse } from "next/server";
import { getCurrentUser, hashPassword, normalizeMobile, passwordValidationError } from "@/lib/auth";
import { suggestedUsername, uniqueUsername } from "@/lib/employee";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== "SOFTWARE_ADMIN") {
    return NextResponse.json({ error: "Software admin access required." }, { status: 403 });
  }

  const agents = await prisma.appUser.findMany({
    where: { role: "HELPDESK" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      username: true,
      mobile: true,
      isVerified: true,
      isActive: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ agents });
}

export async function POST(request: Request) {
  const actor = await getCurrentUser(request);
  if (!actor || actor.role !== "SOFTWARE_ADMIN") {
    return NextResponse.json({ error: "Software admin access required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const mobile = normalizeMobile(String(body?.mobile ?? ""));
  const password = String(body?.password ?? "");

  if (mobile.length < 10) {
    return NextResponse.json({ error: "Enter a valid mobile number." }, { status: 400 });
  }
  const passwordError = passwordValidationError(password);
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  const clash = await prisma.appUser.findFirst({ where: { mobile } });
  if (clash) {
    return NextResponse.json({ error: "Mobile number is already registered." }, { status: 409 });
  }

  const username = await uniqueUsername(suggestedUsername("helpdesk", mobile.slice(-4), "HELPDESK"));

  const agent = await prisma.appUser.create({
    data: {
      username,
      mobile,
      passwordHash: await hashPassword(password),
      otpCode: null,
      otpExpiresAt: null,
      otpAttempts: 0,
      isVerified: true,
      role: "HELPDESK",
    },
    select: { id: true, username: true, mobile: true, role: true },
  });

  await writeAuditLog({
    request,
    actorUserId: actor.id,
    actorUsername: actor.username,
    actorRole: actor.role,
    action: "HELPDESK_USER_CREATED",
    entity: "AppUser",
    entityId: agent.id,
    summary: `${actor.username} created helpdesk agent for mobile ${agent.mobile}.`,
    metadata: { mobile: agent.mobile },
  });

  return NextResponse.json({ ok: true, agent });
}
