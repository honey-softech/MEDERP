import { NextResponse } from "next/server";
import type { AppRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { approveJoinRequest, rejectJoinRequest } from "@/lib/join-requests";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Ctx) {
  const actor = await getCurrentUser(request);
  if (!actor) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const action = String(body?.action ?? "").trim();
  const reviewNote = String(body?.reviewNote ?? "").trim() || undefined;
  const role = body?.role ? (String(body.role) as AppRole) : undefined;

  if (action === "cancel") {
    const existing = await prisma.hospitalJoinRequest.findFirst({
      where: { id, userId: actor.id, status: "PENDING" },
    });
    if (!existing) {
      return NextResponse.json({ error: "Pending request not found." }, { status: 404 });
    }
    await prisma.hospitalJoinRequest.update({
      where: { id: existing.id },
      data: {
        status: "REJECTED",
        reviewNote: "Cancelled by requester.",
        reviewedById: actor.id,
        reviewedAt: new Date(),
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "approve") {
    const result = await approveJoinRequest({ requestId: id, actor, role, reviewNote });
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    await writeAuditLog({
      request,
      hospitalId: result.request.hospitalId,
      actorUserId: actor.id,
      actorUsername: actor.username,
      actorRole: actor.role,
      action: "HOSPITAL_JOIN_APPROVED",
      entity: "HospitalJoinRequest",
      entityId: result.request.id,
      summary: `${actor.username} approved ${result.request.user.username} to join ${result.request.hospital.name} as ${result.role.replace(/_/g, " ")}.`,
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "reject") {
    const result = await rejectJoinRequest({ requestId: id, actor, reviewNote });
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    await writeAuditLog({
      request,
      hospitalId: result.request.hospitalId,
      actorUserId: actor.id,
      actorUsername: actor.username,
      actorRole: actor.role,
      action: "HOSPITAL_JOIN_REJECTED",
      entity: "HospitalJoinRequest",
      entityId: result.request.id,
      summary: `${actor.username} declined ${result.request.user.username}'s request to join ${result.request.hospital.name}.`,
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
