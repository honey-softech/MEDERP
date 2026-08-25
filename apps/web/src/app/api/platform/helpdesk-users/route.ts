import { NextResponse } from "next/server";
import { DEFAULT_OTP, getCurrentUser, hashPassword, normalizeMobile } from "@/lib/auth";
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
  const username = String(body?.username ?? "").trim();
  const mobile = normalizeMobile(String(body?.mobile ?? ""));
  const password = String(body?.password ?? "");

  if (username.length < 3) {
    return NextResponse.json({ error: "Username must be at least 3 characters." }, { status: 400 });
  }
  if (mobile.length < 10) {
    return NextResponse.json({ error: "Enter a valid mobile number." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }

  const clash = await prisma.appUser.findFirst({ where: { OR: [{ username }, { mobile }] } });
  if (clash) {
    return NextResponse.json({ error: "Username or mobile number is already registered." }, { status: 409 });
  }

  const agent = await prisma.appUser.create({
    data: {
      username,
      mobile,
      passwordHash: await hashPassword(password),
      otpCode: DEFAULT_OTP,
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
    summary: `${actor.username} created helpdesk agent ${agent.username}.`,
    metadata: { mobile: agent.mobile },
  });

  return NextResponse.json({ ok: true, agent });
}
