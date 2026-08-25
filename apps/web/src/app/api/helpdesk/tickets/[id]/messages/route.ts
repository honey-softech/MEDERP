import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { canHandleHelpdesk, notifyHelpdeskReply, ticketVisibleWhere } from "@/lib/helpdesk";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { id } = await context.params;
  const ticket = await prisma.helpdeskTicket.findFirst({
    where: { id, ...ticketVisibleWhere(user) },
  });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  }
  if (ticket.status === "CLOSED") {
    return NextResponse.json({ error: "This request is closed." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const message = String(body?.body ?? "").trim();
  if (message.length < 2) {
    return NextResponse.json({ error: "Enter a reply." }, { status: 400 });
  }

  const fromHelpdesk = canHandleHelpdesk(user.role);
  const nextStatus = fromHelpdesk
    ? ticket.status === "RESOLVED"
      ? ticket.status
      : "IN_PROGRESS"
    : "WAITING_REPLY";

  const created = await prisma.helpdeskMessage.create({
    data: { ticketId: ticket.id, authorId: user.id, body: message },
    include: { author: { select: { id: true, username: true, role: true } } },
  });

  const updated = await prisma.helpdeskTicket.update({
    where: { id: ticket.id },
    data: {
      status: nextStatus,
      ...(fromHelpdesk && !ticket.assignedToId ? { assignedToId: user.id } : {}),
    },
  });

  await notifyHelpdeskReply({
    ticket: updated,
    actorId: user.id,
    actorRole: user.role,
    preview: message,
  });

  await writeAuditLog({
    request,
    hospitalId: ticket.hospitalId,
    actorUserId: user.id,
    actorUsername: user.username,
    actorRole: user.role,
    action: "HELPDESK_REPLY",
    entity: "HelpdeskTicket",
    entityId: ticket.id,
    summary: `${user.username} replied on helpdesk ${ticket.number}.`,
  });

  return NextResponse.json({ ok: true, message: created });
}
