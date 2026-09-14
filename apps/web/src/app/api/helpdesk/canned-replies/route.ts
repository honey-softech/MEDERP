import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { canHandleHelpdesk } from "@/lib/helpdesk";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  if (!canHandleHelpdesk(user.role)) {
    return NextResponse.json({ error: "Helpdesk access required." }, { status: 403 });
  }

  const includeInactive = new URL(request.url).searchParams.get("all") === "1";
  const replies = await prisma.helpdeskCannedReply.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: [{ useCount: "desc" }, { title: "asc" }],
    include: { createdBy: { select: { username: true } } },
  });

  return NextResponse.json({ replies });
}

export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  if (!canHandleHelpdesk(user.role)) {
    return NextResponse.json({ error: "Helpdesk access required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const title = String(body?.title ?? "").trim();
  const replyBody = String(body?.body ?? "").trim();
  const category = String(body?.category ?? "").trim().toUpperCase() || null;

  if (title.length < 2) {
    return NextResponse.json({ error: "Enter a title." }, { status: 400 });
  }
  if (replyBody.length < 4) {
    return NextResponse.json({ error: "Enter the reply body." }, { status: 400 });
  }

  const reply = await prisma.helpdeskCannedReply.create({
    data: {
      title,
      body: replyBody,
      category,
      createdById: user.id,
    },
  });

  await writeAuditLog({
    request,
    hospitalId: null,
    actorUserId: user.id,
    actorUsername: user.username,
    actorRole: user.role,
    action: "HELPDESK_CANNED_REPLY_CREATED",
    entity: "HelpdeskCannedReply",
    entityId: reply.id,
    summary: `${user.username} created canned reply "${title}".`,
  });

  return NextResponse.json({ ok: true, reply });
}
