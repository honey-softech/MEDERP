import { NextResponse } from "next/server";
import type { HelpdeskTicketPriority } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import {
  HELPDESK_CATEGORIES,
  HELPDESK_PRIORITIES,
  nextHelpdeskNumber,
  notifyHelpdeskOpened,
  ticketVisibleWhere,
} from "@/lib/helpdesk";

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const tickets = await prisma.helpdeskTicket.findMany({
    where: ticketVisibleWhere(user),
    orderBy: { updatedAt: "desc" },
    include: {
      hospital: { select: { name: true, code: true } },
      createdBy: { select: { username: true, role: true } },
      assignedTo: { select: { username: true } },
      _count: { select: { messages: true } },
    },
  });

  return NextResponse.json({ tickets });
}

export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const subject = String(body?.subject ?? "").trim();
  const category = String(body?.category ?? "OTHER").trim().toUpperCase();
  const message = String(body?.body ?? "").trim();
  const priority = String(body?.priority ?? "NORMAL") as HelpdeskTicketPriority;

  if (subject.length < 4) {
    return NextResponse.json({ error: "Enter a short subject." }, { status: 400 });
  }
  if (message.length < 8) {
    return NextResponse.json({ error: "Describe the issue in a bit more detail." }, { status: 400 });
  }
  if (!HELPDESK_CATEGORIES.some((item) => item.value === category)) {
    return NextResponse.json({ error: "Select a valid category." }, { status: 400 });
  }
  if (!HELPDESK_PRIORITIES.some((item) => item.value === priority)) {
    return NextResponse.json({ error: "Select a valid priority." }, { status: 400 });
  }

  const ticket = await prisma.helpdeskTicket.create({
    data: {
      number: await nextHelpdeskNumber(),
      hospitalId: user.hospitalId,
      createdById: user.id,
      subject,
      category,
      priority,
      messages: { create: { authorId: user.id, body: message } },
    },
  });

  await notifyHelpdeskOpened(ticket, user.id);
  await writeAuditLog({
    request,
    hospitalId: user.hospitalId,
    actorUserId: user.id,
    actorUsername: user.username,
    actorRole: user.role,
    action: "HELPDESK_TICKET_OPENED",
    entity: "HelpdeskTicket",
    entityId: ticket.id,
    summary: `${user.username} opened helpdesk ${ticket.number}: ${ticket.subject}.`,
  });

  return NextResponse.json({ ok: true, ticket });
}
