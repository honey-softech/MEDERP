import { NextResponse } from "next/server";
import { diffAuditFields, writeAuditLog } from "@/lib/audit";
import { getCurrentUser, invalidateUserSessions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  const actor = await getCurrentUser(request);
  if (!actor || actor.role !== "SOFTWARE_ADMIN") {
    return NextResponse.json({ error: "Software admin access required." }, { status: 403 });
  }

  const { id: survivorId } = await context.params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const duplicateId = String(body?.duplicateId ?? "").trim();
  if (!duplicateId || duplicateId === survivorId) {
    return NextResponse.json({ error: "Select a different user to merge." }, { status: 400 });
  }

  const [survivor, duplicate] = await Promise.all([
    prisma.appUser.findUnique({ where: { id: survivorId } }),
    prisma.appUser.findUnique({ where: { id: duplicateId } }),
  ]);
  if (!survivor || !duplicate) {
    return NextResponse.json({ error: "Both users must exist." }, { status: 404 });
  }
  if (survivor.role === "SOFTWARE_ADMIN" || survivor.role === "HELPDESK") {
    return NextResponse.json({ error: "Platform accounts cannot be merge targets." }, { status: 403 });
  }
  if (duplicate.role === "SOFTWARE_ADMIN" || duplicate.role === "HELPDESK") {
    return NextResponse.json({ error: "Platform accounts cannot be merged away." }, { status: 403 });
  }
  if (!survivor.hospitalId || survivor.hospitalId !== duplicate.hospitalId) {
    return NextResponse.json({ error: "Both users must belong to the same hospital." }, { status: 400 });
  }

  const suffix = `merged-${duplicate.id.slice(-6)}`;
  await prisma.$transaction(async (tx) => {
    await tx.appSession.deleteMany({ where: { userId: duplicate.id } });
    await tx.staffNotification.updateMany({ where: { userId: duplicate.id }, data: { userId: survivor.id } });
    await tx.hospitalJoinRequest.updateMany({ where: { userId: duplicate.id }, data: { userId: survivor.id } });
    await tx.hospitalJoinRequest.updateMany({
      where: { reviewedById: duplicate.id },
      data: { reviewedById: survivor.id },
    });
    await tx.helpdeskTicket.updateMany({ where: { createdById: duplicate.id }, data: { createdById: survivor.id } });
    await tx.helpdeskTicket.updateMany({
      where: { assignedToId: duplicate.id },
      data: { assignedToId: survivor.id },
    });
    await tx.helpdeskMessage.updateMany({ where: { authorId: duplicate.id }, data: { authorId: survivor.id } });
    await tx.staffLeave.updateMany({
      where: { requestedByUserId: duplicate.id },
      data: { requestedByUserId: survivor.id },
    });
    await tx.staffLeave.updateMany({
      where: { reviewedByUserId: duplicate.id },
      data: { reviewedByUserId: survivor.id },
    });
    await tx.userSignature.updateMany({ where: { userId: duplicate.id }, data: { userId: survivor.id } });
    await tx.hospitalAnnouncement.updateMany({
      where: { authorId: duplicate.id },
      data: { authorId: survivor.id },
    });
    await tx.hospitalAnnouncementReply.updateMany({
      where: { authorId: duplicate.id },
      data: { authorId: survivor.id },
    });

    const duplicateStaff = await tx.staff.findUnique({ where: { appUserId: duplicate.id } });
    const survivorStaff = await tx.staff.findUnique({ where: { appUserId: survivor.id } });
    if (duplicateStaff) {
      if (survivorStaff) {
        await tx.staffLeave.updateMany({
          where: { staffId: duplicateStaff.id },
          data: { staffId: survivorStaff.id },
        });
        await tx.staff.delete({ where: { id: duplicateStaff.id } });
      } else {
        await tx.staff.update({
          where: { id: duplicateStaff.id },
          data: { appUserId: survivor.id },
        });
      }
    }

    await tx.appUser.update({
      where: { id: duplicate.id },
      data: {
        isActive: false,
        isVerified: false,
        hospitalId: null,
        username: `${duplicate.username}-${suffix}`.slice(0, 60),
        mobile: `merged-${duplicate.id}`,
        userCode: null,
        employeeId: null,
        otpCode: null,
        otpExpiresAt: null,
        otpAttempts: 0,
      },
    });
  });

  await invalidateUserSessions(duplicate.id);

  await writeAuditLog({
    request,
    hospitalId: survivor.hospitalId,
    actorUserId: actor.id,
    actorUsername: actor.username,
    actorRole: actor.role,
    action: "STAFF_USER_MERGED",
    entity: "AppUser",
    entityId: survivor.id,
    summary: `${actor.username} merged ${duplicate.username} into ${survivor.username}.`,
    metadata: {
      duplicateId: duplicate.id,
      changes: diffAuditFields(
        { hospitalId: duplicate.hospitalId, isActive: duplicate.isActive },
        { hospitalId: null, isActive: false },
        { fields: ["hospitalId", "isActive"] },
      ),
    },
  });

  return NextResponse.json({
    ok: true,
    survivor: { id: survivor.id, username: survivor.username, mobile: survivor.mobile },
    duplicate: { id: duplicate.id },
  });
}
