import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canHandleHelpdesk, ticketVisibleWhere } from "@/lib/helpdesk";
import { prisma } from "@/lib/prisma";
import { canRunSupportAction, runSupportAction, SUPPORT_ACTIONS } from "@/lib/support-actions";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Ctx) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  if (!canRunSupportAction(user.role)) {
    return NextResponse.json({ error: "Helpdesk or software admin access required." }, { status: 403 });
  }

  return NextResponse.json({
    actions: SUPPORT_ACTIONS.filter((action) => action.tier === "support"),
  });
}

export async function POST(request: Request, context: Ctx) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  if (!canRunSupportAction(user.role)) {
    return NextResponse.json({ error: "Helpdesk or software admin access required." }, { status: 403 });
  }
  if (!canHandleHelpdesk(user.role)) {
    return NextResponse.json({ error: "Helpdesk access required." }, { status: 403 });
  }

  const { id } = await context.params;
  const ticket = await prisma.helpdeskTicket.findFirst({
    where: { id, ...ticketVisibleWhere(user) },
    select: {
      id: true,
      number: true,
      hospitalId: true,
      createdById: true,
      status: true,
      firstResponseAt: true,
      assignedToId: true,
    },
  });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  }
  if (ticket.status === "CLOSED") {
    return NextResponse.json({ error: "Reopen or use an open ticket before running support actions." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = String(body?.action ?? "").trim().toUpperCase();
  const result = await runSupportAction({
    request,
    actor: user,
    ticket,
    action,
    targetUserId: body?.targetUserId ? String(body.targetUserId) : undefined,
    password: body?.password != null ? String(body.password) : undefined,
    mobile: body?.mobile != null ? String(body.mobile) : undefined,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  if (ticket.status === "OPEN" || ticket.status === "WAITING_REPLY") {
    const now = new Date();
    await prisma.helpdeskTicket.update({
      where: { id: ticket.id },
      data: {
        status: "IN_PROGRESS",
        assignedToId: ticket.assignedToId ?? user.id,
        ...(ticket.firstResponseAt ? {} : { firstResponseAt: now }),
      },
    });
  }

  return NextResponse.json({ ok: true, summary: result.summary, threadNote: result.threadNote });
}
