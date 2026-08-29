import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit";
import { canManageAnnouncement, deleteReply } from "@/lib/board";
import { requireHospitalActor } from "@/lib/front-desk";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; replyId: string }> },
) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;

  const { id, replyId } = await params;
  const existing = await prisma.hospitalAnnouncementReply.findFirst({
    where: {
      id: replyId,
      announcementId: id,
      announcement: { hospitalId: scoped.user.hospitalId },
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Reply not found." }, { status: 404 });
  }
  if (!canManageAnnouncement(scoped.user, existing.authorId)) {
    return NextResponse.json({ error: "You can only delete your own replies." }, { status: 403 });
  }

  const result = await deleteReply({
    announcementId: id,
    replyId,
    hospitalId: scoped.user.hospitalId,
  });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await writeAuditLog({
    request,
    hospitalId: scoped.user.hospitalId,
    actorUserId: scoped.user.id,
    actorUsername: scoped.user.username,
    actorRole: scoped.user.role,
    action: "BOARD_REPLY_DELETED",
    entity: "HospitalAnnouncementReply",
    entityId: result.reply.id,
    summary: `${scoped.user.username} deleted a reply on the hospital board.`,
  });

  return NextResponse.json({ ok: true });
}
