import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { canHandleHelpdesk, notifyHelpdeskEscalated, ticketVisibleWhere } from "@/lib/helpdesk";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  if (!canHandleHelpdesk(user.role)) {
    return NextResponse.json({ error: "Helpdesk access required." }, { status: 403 });
  }

  const { id } = await context.params;
  const ticket = await prisma.helpdeskTicket.findFirst({
    where: { id, ...ticketVisibleWhere(user) },
  });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  }
  if (ticket.status === "CLOSED" || ticket.status === "RESOLVED") {
    return NextResponse.json({ error: "Reopen the ticket before escalating it." }, { status: 400 });
  }
  if (ticket.status === "ESCALATED") {
    return NextResponse.json({ error: "This ticket is already escalated." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const reason = String(body?.reason ?? "").trim();
  if (reason.length < 8) {
    return NextResponse.json(
      { error: "Explain why this needs a software admin (at least a short reason)." },
      { status: 400 },
    );
  }

  const updated = await prisma.helpdeskTicket.update({
    where: { id: ticket.id },
    data: {
      status: "ESCALATED",
      escalatedAt: new Date(),
      escalatedById: user.id,
      escalationReason: reason,
      assignedToId: ticket.assignedToId ?? user.id,
    },
  });

  await prisma.helpdeskMessage.create({
    data: {
      ticketId: ticket.id,
      authorId: user.id,
      body: `Escalated to software admin: ${reason}`,
      kind: "SYSTEM",
    },
  });

  await notifyHelpdeskEscalated({
    ticket: updated,
    actorId: user.id,
    reason,
  });

  await writeAuditLog({
    request,
    hospitalId: ticket.hospitalId,
    actorUserId: user.id,
    actorUsername: user.username,
    actorRole: user.role,
    action: "HELPDESK_TICKET_ESCALATED",
    entity: "HelpdeskTicket",
    entityId: ticket.id,
    summary: `${user.username} escalated helpdesk ${ticket.number}.`,
    metadata: { reason, previousStatus: ticket.status },
  });

  return NextResponse.json({ ok: true, ticket: updated });
}
