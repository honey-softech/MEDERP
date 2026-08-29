import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit";
import { boardAuthorName, createReply, parseReplyBody } from "@/lib/board";
import { requireHospitalActor } from "@/lib/front-desk";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;

  const { id } = await params;
  const payload = await request.json().catch(() => null);
  const body = parseReplyBody(payload?.body);
  if ("error" in body) {
    return NextResponse.json({ error: body.error }, { status: 400 });
  }

  const result = await createReply({
    announcementId: id,
    hospitalId: scoped.user.hospitalId,
    authorId: scoped.user.id,
    authorName: boardAuthorName(scoped.user),
    body: body.body,
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
    action: "BOARD_REPLY_CREATED",
    entity: "HospitalAnnouncementReply",
    entityId: result.reply.id,
    summary: `${scoped.user.username} replied on the hospital board.`,
  });

  return NextResponse.json({ reply: result.reply });
}
