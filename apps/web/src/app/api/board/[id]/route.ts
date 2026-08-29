import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit";
import { canManageAnnouncement, deleteAnnouncement, getAnnouncementInHospital, setAnnouncementPinned } from "@/lib/board";
import { requireHospitalActor } from "@/lib/front-desk";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  if (scoped.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Only the hospital admin can pin announcements." }, { status: 403 });
  }

  const { id } = await params;
  const payload = await request.json().catch(() => null);
  if (typeof payload?.pinned !== "boolean") {
    return NextResponse.json({ error: "Set pinned to true or false." }, { status: 400 });
  }

  const result = await setAnnouncementPinned({
    id,
    hospitalId: scoped.user.hospitalId,
    pinned: payload.pinned,
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
    action: payload.pinned ? "BOARD_POST_PINNED" : "BOARD_POST_UNPINNED",
    entity: "HospitalAnnouncement",
    entityId: result.post.id,
    summary: `${scoped.user.username} ${payload.pinned ? "pinned" : "unpinned"} “${result.post.title}” on the hospital board.`,
  });

  return NextResponse.json({ post: result.post });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;

  const { id } = await params;
  const existing = await getAnnouncementInHospital(id, scoped.user.hospitalId);
  if (!existing) {
    return NextResponse.json({ error: "Announcement not found." }, { status: 404 });
  }
  if (!canManageAnnouncement(scoped.user, existing.authorId)) {
    return NextResponse.json({ error: "You can only delete your own posts." }, { status: 403 });
  }

  const result = await deleteAnnouncement({ id, hospitalId: scoped.user.hospitalId });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await writeAuditLog({
    request,
    hospitalId: scoped.user.hospitalId,
    actorUserId: scoped.user.id,
    actorUsername: scoped.user.username,
    actorRole: scoped.user.role,
    action: "BOARD_POST_DELETED",
    entity: "HospitalAnnouncement",
    entityId: result.post.id,
    summary: `${scoped.user.username} deleted “${result.post.title}” from the hospital board.`,
  });

  return NextResponse.json({ ok: true });
}
