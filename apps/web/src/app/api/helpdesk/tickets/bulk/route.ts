import { NextResponse } from "next/server";
import type { HelpdeskTicketPriority, HelpdeskTicketStatus } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { canHandleHelpdesk, notifyHelpdeskStatusChange, ticketVisibleWhere } from "@/lib/helpdesk";
import { HELPDESK_PRIORITIES } from "@/lib/helpdesk-options";
import { slaDueDates } from "@/lib/helpdesk-sla";
import { prisma } from "@/lib/prisma";

const STATUSES: HelpdeskTicketStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING_REPLY",
  "ESCALATED",
  "RESOLVED",
  "CLOSED",
];

export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  if (!canHandleHelpdesk(user.role)) {
    return NextResponse.json({ error: "Helpdesk access required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const ticketIds = Array.isArray(body?.ticketIds)
    ? [...new Set(body.ticketIds.map((id) => String(id)).filter(Boolean))].slice(0, 50)
    : [];
  const action = String(body?.action ?? "").trim().toUpperCase();
  const value = body?.value === null || body?.value === undefined ? null : String(body.value);

  if (ticketIds.length === 0) {
    return NextResponse.json({ error: "Select at least one ticket." }, { status: 400 });
  }
  if (!["ASSIGN", "STATUS", "PRIORITY"].includes(action)) {
    return NextResponse.json({ error: "Unknown bulk action." }, { status: 400 });
  }

  if (action === "ASSIGN" && value) {
    const agent = await prisma.appUser.findFirst({
      where: { id: value, role: { in: ["SOFTWARE_ADMIN", "HELPDESK"] }, isActive: true },
      select: { id: true },
    });
    if (!agent) {
      return NextResponse.json({ error: "Assign to a helpdesk or software admin account." }, { status: 400 });
    }
  }
  if (action === "STATUS" && (!value || !STATUSES.includes(value as HelpdeskTicketStatus))) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }
  if (
    action === "PRIORITY" &&
    (!value || (!HELPDESK_PRIORITIES.some((item) => item.value === value) && value !== "URGENT"))
  ) {
    return NextResponse.json({ error: "Invalid priority." }, { status: 400 });
  }

  const tickets = await prisma.helpdeskTicket.findMany({
    where: { id: { in: ticketIds }, ...ticketVisibleWhere(user) },
  });
  if (tickets.length === 0) {
    return NextResponse.json({ error: "No matching tickets." }, { status: 404 });
  }

  const now = new Date();
  let updatedCount = 0;

  for (const ticket of tickets) {
    if (action === "ASSIGN") {
      const assignedToId = value;
      await prisma.helpdeskTicket.update({
        where: { id: ticket.id },
        data: { assignedToId },
      });
      await writeAuditLog({
        request,
        hospitalId: ticket.hospitalId,
        actorUserId: user.id,
        actorUsername: user.username,
        actorRole: user.role,
        action: "HELPDESK_TICKET_UPDATED",
        entity: "HelpdeskTicket",
        entityId: ticket.id,
        summary: `${user.username} bulk-assigned helpdesk ${ticket.number}.`,
        metadata: { assignedToId, bulk: true },
      });
      updatedCount += 1;
      continue;
    }

    if (action === "PRIORITY") {
      const priority = value as HelpdeskTicketPriority;
      const due = slaDueDates(priority, ticket.createdAt);
      await prisma.helpdeskTicket.update({
        where: { id: ticket.id },
        data: {
          priority,
          // Only refresh due dates that have not already been met.
          ...(ticket.firstResponseAt ? {} : { firstResponseDueAt: due.firstResponseDueAt }),
          ...(ticket.resolvedAt ? {} : { resolutionDueAt: due.resolutionDueAt }),
        },
      });
      await writeAuditLog({
        request,
        hospitalId: ticket.hospitalId,
        actorUserId: user.id,
        actorUsername: user.username,
        actorRole: user.role,
        action: "HELPDESK_TICKET_UPDATED",
        entity: "HelpdeskTicket",
        entityId: ticket.id,
        summary: `${user.username} bulk-set priority on helpdesk ${ticket.number} to ${priority}.`,
        metadata: { priority, bulk: true },
      });
      updatedCount += 1;
      continue;
    }

    const status = value as HelpdeskTicketStatus;
    if (status === ticket.status) continue;

    const data: {
      status: HelpdeskTicketStatus;
      resolvedAt?: Date | null;
      closedAt?: Date | null;
      firstResponseAt?: Date;
    } = { status };

    if (status === "RESOLVED") {
      data.resolvedAt = now;
      data.closedAt = null;
    } else if (status === "CLOSED") {
      data.closedAt = now;
      data.resolvedAt = ticket.resolvedAt ?? now;
    } else if (ticket.status === "RESOLVED" || ticket.status === "CLOSED") {
      data.resolvedAt = null;
      data.closedAt = null;
    }
    if ((status === "IN_PROGRESS" || status === "WAITING_REPLY") && !ticket.firstResponseAt) {
      data.firstResponseAt = now;
    }

    const updated = await prisma.helpdeskTicket.update({
      where: { id: ticket.id },
      data,
    });
    await notifyHelpdeskStatusChange({
      ticket: updated,
      actorId: user.id,
      previousStatus: ticket.status,
    });
    await writeAuditLog({
      request,
      hospitalId: ticket.hospitalId,
      actorUserId: user.id,
      actorUsername: user.username,
      actorRole: user.role,
      action: "HELPDESK_TICKET_UPDATED",
      entity: "HelpdeskTicket",
      entityId: ticket.id,
      summary: `${user.username} bulk-updated helpdesk ${ticket.number} to ${status}.`,
      metadata: { status, bulk: true },
    });
    updatedCount += 1;
  }

  return NextResponse.json({ ok: true, updated: updatedCount });
}
