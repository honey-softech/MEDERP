import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { canHandleHelpdesk } from "@/lib/helpdesk";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Ctx) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  if (!canHandleHelpdesk(user.role)) {
    return NextResponse.json({ error: "Helpdesk access required." }, { status: 403 });
  }

  const { id } = await context.params;
  const existing = await prisma.helpdeskCannedReply.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Canned reply not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const bumpUse = body?.bumpUse === true;

  if (bumpUse) {
    const reply = await prisma.helpdeskCannedReply.update({
      where: { id },
      data: { useCount: { increment: 1 } },
    });
    return NextResponse.json({ ok: true, reply });
  }

  if (user.role !== "SOFTWARE_ADMIN" && existing.createdById !== user.id) {
    return NextResponse.json(
      { error: "Only software admin can edit canned replies created by others." },
      { status: 403 },
    );
  }

  const title = body?.title != null ? String(body.title).trim() : undefined;
  const replyBody = body?.body != null ? String(body.body).trim() : undefined;
  const category =
    body?.category === null
      ? null
      : body?.category != null
        ? String(body.category).trim().toUpperCase() || null
        : undefined;
  const isActive = typeof body?.isActive === "boolean" ? body.isActive : undefined;

  if (title !== undefined && title.length < 2) {
    return NextResponse.json({ error: "Enter a title." }, { status: 400 });
  }
  if (replyBody !== undefined && replyBody.length < 4) {
    return NextResponse.json({ error: "Enter the reply body." }, { status: 400 });
  }

  const reply = await prisma.helpdeskCannedReply.update({
    where: { id },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(replyBody !== undefined ? { body: replyBody } : {}),
      ...(category !== undefined ? { category } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    },
  });

  await writeAuditLog({
    request,
    hospitalId: null,
    actorUserId: user.id,
    actorUsername: user.username,
    actorRole: user.role,
    action: "HELPDESK_CANNED_REPLY_UPDATED",
    entity: "HelpdeskCannedReply",
    entityId: reply.id,
    summary: `${user.username} updated canned reply "${reply.title}".`,
  });

  return NextResponse.json({ ok: true, reply });
}

export async function DELETE(request: Request, context: Ctx) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  if (!canHandleHelpdesk(user.role)) {
    return NextResponse.json({ error: "Helpdesk access required." }, { status: 403 });
  }

  const { id } = await context.params;
  const existing = await prisma.helpdeskCannedReply.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Canned reply not found." }, { status: 404 });
  }
  if (user.role !== "SOFTWARE_ADMIN" && existing.createdById !== user.id) {
    return NextResponse.json(
      { error: "Only software admin can delete canned replies created by others." },
      { status: 403 },
    );
  }

  await prisma.helpdeskCannedReply.delete({ where: { id } });
  await writeAuditLog({
    request,
    hospitalId: null,
    actorUserId: user.id,
    actorUsername: user.username,
    actorRole: user.role,
    action: "HELPDESK_CANNED_REPLY_DELETED",
    entity: "HelpdeskCannedReply",
    entityId: id,
    summary: `${user.username} deleted canned reply "${existing.title}".`,
  });

  return NextResponse.json({ ok: true });
}
