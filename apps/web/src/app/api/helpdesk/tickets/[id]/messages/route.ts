import { NextResponse } from "next/server";
import type { HelpdeskMessageKind, Prisma } from "@prisma/client";
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

  const requestedKind = String(body?.kind ?? "PUBLIC").toUpperCase() as HelpdeskMessageKind;
  const fromHelpdesk = canHandleHelpdesk(user.role);
  if (requestedKind === "INTERNAL" && !fromHelpdesk) {
    return NextResponse.json({ error: "Only helpdesk can post internal notes." }, { status: 403 });
  }
  if (requestedKind === "SYSTEM") {
    return NextResponse.json({ error: "System notes cannot be posted manually." }, { status: 400 });
  }
  const kind: HelpdeskMessageKind = requestedKind === "INTERNAL" ? "INTERNAL" : "PUBLIC";

  // Internal notes never change status or notify the requester.
  if (kind === "INTERNAL") {
    const created = await prisma.helpdeskMessage.create({
      data: { ticketId: ticket.id, authorId: user.id, body: message, kind },
      include: { author: { select: { id: true, username: true, role: true } } },
    });
    await writeAuditLog({
      request,
      hospitalId: ticket.hospitalId,
      actorUserId: user.id,
      actorUsername: user.username,
      actorRole: user.role,
      action: "HELPDESK_INTERNAL_NOTE",
      entity: "HelpdeskTicket",
      entityId: ticket.id,
      summary: `${user.username} added an internal note on helpdesk ${ticket.number}.`,
    });
    return NextResponse.json({ ok: true, message: created });
  }

  const now = new Date();
  const data: Prisma.HelpdeskTicketUpdateInput = {
    lastAgentReplyAt: fromHelpdesk ? now : undefined,
    lastRequesterReplyAt: fromHelpdesk ? undefined : now,
  };

  if (fromHelpdesk) {
    if (!ticket.assignedToId) {
      data.assignedTo = { connect: { id: user.id } };
    }
    if (!ticket.firstResponseAt) {
      data.firstResponseAt = now;
    }
    // Agent reply → waiting on requester (keep ESCALATED until software admin clears it)
    if (ticket.status !== "ESCALATED" && ticket.status !== "RESOLVED") {
      data.status = "WAITING_REPLY";
    }
  } else if (ticket.status === "RESOLVED") {
    data.status = "OPEN";
    data.resolvedAt = null;
    data.reopenedCount = { increment: 1 };
  } else {
    // Requester reply → ball with helpdesk
    data.status = "IN_PROGRESS";
  }

  const created = await prisma.helpdeskMessage.create({
    data: { ticketId: ticket.id, authorId: user.id, body: message, kind: "PUBLIC" },
    include: { author: { select: { id: true, username: true, role: true } } },
  });

  const updated = await prisma.helpdeskTicket.update({
    where: { id: ticket.id },
    data,
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
