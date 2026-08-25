import { NextResponse } from "next/server";
import type { AppRole } from "@prisma/client";
import { STAFF_ROLES, getCurrentUser, isPlatformRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { notifyJoinRequested } from "@/lib/join-requests";

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const where =
    user.role === "SOFTWARE_ADMIN"
      ? {}
      : user.role === "SUPER_ADMIN" && user.hospitalId
        ? { hospitalId: user.hospitalId }
        : { userId: user.id };

  const requests = await prisma.hospitalJoinRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, username: true, mobile: true, role: true } },
      hospital: { select: { id: true, name: true, code: true } },
    },
  });

  return NextResponse.json({ requests });
}

export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  if (isPlatformRole(user.role)) {
    return NextResponse.json({ error: "Platform accounts cannot join a hospital." }, { status: 403 });
  }
  if (user.hospitalId) {
    return NextResponse.json({ error: "You already belong to a hospital." }, { status: 409 });
  }

  const body = await request.json().catch(() => null);
  const hospitalId = String(body?.hospitalId ?? "").trim();
  const requestedRole = String(body?.role ?? user.role) as AppRole;
  const note = String(body?.note ?? "").trim() || null;

  if (!hospitalId) {
    return NextResponse.json({ error: "Select a listed hospital." }, { status: 400 });
  }
  if (!STAFF_ROLES.includes(requestedRole)) {
    return NextResponse.json({ error: "Select a valid hospital role." }, { status: 400 });
  }

  const hospital = await prisma.hospital.findUnique({ where: { id: hospitalId } });
  if (!hospital || !hospital.isActive) {
    return NextResponse.json({ error: "That hospital is not listed." }, { status: 400 });
  }

  const existing = await prisma.hospitalJoinRequest.findFirst({
    where: { userId: user.id, hospitalId, status: "PENDING" },
  });
  if (existing) {
    return NextResponse.json({ error: "You already have a pending request for this hospital." }, { status: 409 });
  }

  const joinRequest = await prisma.hospitalJoinRequest.create({
    data: {
      userId: user.id,
      hospitalId,
      requestedRole,
      note,
    },
    include: { hospital: { select: { id: true, name: true, code: true } } },
  });

  await notifyJoinRequested({
    hospitalId,
    requesterName: user.username,
    role: requestedRole,
  });

  await writeAuditLog({
    request,
    hospitalId,
    actorUserId: user.id,
    actorUsername: user.username,
    actorRole: user.role,
    action: "HOSPITAL_JOIN_REQUESTED",
    entity: "HospitalJoinRequest",
    entityId: joinRequest.id,
    summary: `${user.username} requested to join ${hospital.name} as ${requestedRole.replace(/_/g, " ")}.`,
  });

  return NextResponse.json({ ok: true, request: joinRequest });
}
