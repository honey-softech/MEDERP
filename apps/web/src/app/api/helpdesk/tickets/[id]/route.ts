import { NextResponse } from "next/server";
import type { HelpdeskTicketStatus } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { diffAuditFields, writeAuditLog } from "@/lib/audit";
import { canHandleHelpdesk, notifyHelpdeskStatusChange, ticketVisibleWhere } from "@/lib/helpdesk";

type Ctx = { params: Promise<{ id: string }> };

const STATUSES: HelpdeskTicketStatus[] = ["OPEN", "IN_PROGRESS", "WAITING_REPLY", "RESOLVED", "CLOSED"];

export async function GET(request: Request, context: Ctx) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { id } = await context.params;
  const ticket = await prisma.helpdeskTicket.findFirst({
    where: { id, ...ticketVisibleWhere(user) },
    include: {
      hospital: { select: { id: true, name: true, code: true } },
      createdBy: { select: { id: true, username: true, role: true, mobile: true } },
      assignedTo: { select: { id: true, username: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, username: true, role: true } } },
      },
    },
  });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  }

  return NextResponse.json({ ticket });
}

export async function PATCH(request: Request, context: Ctx) {
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

  const body = await request.json().catch(() => null);
  const status = body?.status ? (String(body.status) as HelpdeskTicketStatus) : undefined;
  const assignedToId = body?.assignedToId === null ? null : body?.assignedToId ? String(body.assignedToId) : undefined;

  if (status && !STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }
  if (assignedToId) {
    const agent = await prisma.appUser.findFirst({
      where: { id: assignedToId, role: { in: ["SOFTWARE_ADMIN", "HELPDESK"] } },
      select: { id: true },
    });
    if (!agent) {
      return NextResponse.json({ error: "Assign to a helpdesk or software admin account." }, { status: 400 });
    }
  }

  const updated = await prisma.helpdeskTicket.update({
    where: { id: ticket.id },
    data: {
      ...(status ? { status } : {}),
      ...(assignedToId !== undefined ? { assignedToId } : {}),
    },
  });

  if (status && status !== ticket.status) {
    await notifyHelpdeskStatusChange({
      ticket: updated,
      actorId: user.id,
      previousStatus: ticket.status,
    });
  }

  await writeAuditLog({
    request,
    hospitalId: ticket.hospitalId,
    actorUserId: user.id,
    actorUsername: user.username,
    actorRole: user.role,
    action: "HELPDESK_TICKET_UPDATED",
    entity: "HelpdeskTicket",
    entityId: ticket.id,
    summary: `${user.username} updated helpdesk ${ticket.number}.`,
    metadata: {
      status: updated.status,
      assignedToId: updated.assignedToId,
      changes: diffAuditFields(
        { status: ticket.status, assignedToId: ticket.assignedToId },
        { status: updated.status, assignedToId: updated.assignedToId },
        { fields: ["status", "assignedToId"] },
      ),
    },
  });

  return NextResponse.json({ ok: true, ticket: updated });
}
