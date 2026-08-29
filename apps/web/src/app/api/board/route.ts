import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit";
import {
  boardAuthorName,
  createAnnouncement,
  listAnnouncements,
  parseAnnouncementBody,
  parseAnnouncementTitle,
} from "@/lib/board";
import { requireHospitalActor } from "@/lib/front-desk";

export async function GET(request: Request) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;

  const url = new URL(request.url);
  const takeRaw = Number(url.searchParams.get("take") ?? "50");
  const take = Number.isFinite(takeRaw) ? Math.min(Math.max(takeRaw, 1), 100) : 50;
  const includeReplies = url.searchParams.get("replies") === "1";

  const posts = await listAnnouncements(scoped.user.hospitalId, { take, includeReplies });
  return NextResponse.json({ posts });
}

export async function POST(request: Request) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;

  const payload = await request.json().catch(() => null);
  const title = parseAnnouncementTitle(payload?.title);
  if ("error" in title) {
    return NextResponse.json({ error: title.error }, { status: 400 });
  }
  const body = parseAnnouncementBody(payload?.body);
  if ("error" in body) {
    return NextResponse.json({ error: body.error }, { status: 400 });
  }

  const post = await createAnnouncement({
    hospitalId: scoped.user.hospitalId,
    authorId: scoped.user.id,
    authorName: boardAuthorName(scoped.user),
    title: title.title,
    body: body.body,
  });

  await writeAuditLog({
    request,
    hospitalId: scoped.user.hospitalId,
    actorUserId: scoped.user.id,
    actorUsername: scoped.user.username,
    actorRole: scoped.user.role,
    action: "BOARD_POST_CREATED",
    entity: "HospitalAnnouncement",
    entityId: post.id,
    summary: `${scoped.user.username} posted “${post.title}” on the hospital board.`,
  });

  return NextResponse.json({ post });
}
