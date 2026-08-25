import type { AppRole, AppUser, HelpdeskTicket, HelpdeskTicketStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notifications";
import { pushHelpdeskTicketUpdate } from "@/lib/realtime";
import { HELPDESK_CATEGORIES, HELPDESK_PRIORITIES, prettyTicketStatus, statusBadgeClass } from "@/lib/helpdesk-options";

export { HELPDESK_CATEGORIES, HELPDESK_PRIORITIES, prettyTicketStatus, statusBadgeClass };

export function canHandleHelpdesk(role: AppRole) {
  return role === "SOFTWARE_ADMIN" || role === "HELPDESK";
}

export function ticketVisibleWhere(user: Pick<AppUser, "id" | "role" | "hospitalId">): Prisma.HelpdeskTicketWhereInput {
  if (canHandleHelpdesk(user.role)) return {};
  if (user.role === "SUPER_ADMIN" && user.hospitalId) {
    return { OR: [{ hospitalId: user.hospitalId }, { createdById: user.id }] };
  }
  return { createdById: user.id };
}

export async function nextHelpdeskNumber() {
  const count = await prisma.helpdeskTicket.count();
  return `HD-${String(count + 1).padStart(6, "0")}`;
}

type TicketNotify = Pick<
  HelpdeskTicket,
  "id" | "number" | "hospitalId" | "createdById" | "assignedToId" | "subject" | "status"
>;

async function ticketWatchers(ticket: TicketNotify, actorId: string) {
  const recipients: Array<{ id: string; hospitalId?: string | null }> = [];
  const creator = await prisma.appUser.findUnique({
    where: { id: ticket.createdById },
    select: { id: true, hospitalId: true },
  });
  if (creator) recipients.push(creator);
  if (ticket.hospitalId) {
    recipients.push(...(await hospitalSuperAdmins(ticket.hospitalId)));
  }
  const handlers = await platformHandlers();
  recipients.push(...handlers);
  if (ticket.assignedToId) {
    const assigned = await prisma.appUser.findUnique({
      where: { id: ticket.assignedToId },
      select: { id: true, hospitalId: true },
    });
    if (assigned) recipients.push(assigned);
  }
  return recipients.filter((user) => user.id !== actorId);
}

function uniqueUserIds(users: Array<{ id: string }>) {
  return [...new Set(users.map((user) => user.id))];
}

async function pushTicketLiveUpdate(ticket: TicketNotify, actorId: string) {
  const watchers = await ticketWatchers(ticket, actorId);
  pushHelpdeskTicketUpdate(uniqueUserIds(watchers), {
    ticketId: ticket.id,
    status: ticket.status,
    number: ticket.number,
  });
}

export async function notifyHelpdeskStatusChange(params: {
  ticket: TicketNotify & { status: HelpdeskTicketStatus };
  actorId: string;
  previousStatus: HelpdeskTicketStatus;
}) {
  if (params.ticket.status === params.previousStatus) return;
  const label = prettyTicketStatus(params.ticket.status);
  const href = `/helpdesk/${params.ticket.id}`;
  const watchers = await ticketWatchers(params.ticket, params.actorId);
  await notifyMany(watchers, {
    hospitalId: params.ticket.hospitalId,
    href,
    title: "Helpdesk status updated",
    body: `${params.ticket.number} is now ${label}.`,
  });
  pushHelpdeskTicketUpdate(uniqueUserIds(watchers), {
    ticketId: params.ticket.id,
    status: params.ticket.status,
    number: params.ticket.number,
  });
}

async function platformHandlers() {
  return prisma.appUser.findMany({
    where: { role: { in: ["SOFTWARE_ADMIN", "HELPDESK"] }, isVerified: true, isActive: true },
    select: { id: true, hospitalId: true },
  });
}

async function hospitalSuperAdmins(hospitalId: string) {
  return prisma.appUser.findMany({
    where: { hospitalId, role: "SUPER_ADMIN", isVerified: true, isActive: true },
    select: { id: true, hospitalId: true },
  });
}

async function notifyMany(
  users: Array<{ id: string; hospitalId?: string | null }>,
  params: { title: string; body: string; href: string; hospitalId?: string | null },
) {
  const seen = new Set<string>();
  for (const user of users) {
    if (seen.has(user.id)) continue;
    seen.add(user.id);
    await notifyUser({
      hospitalId: user.hospitalId ?? params.hospitalId ?? null,
      userId: user.id,
      title: params.title,
      body: params.body,
      href: params.href,
    });
  }
}

export async function notifyHelpdeskOpened(ticket: TicketNotify, actorId: string) {
  const href = `/helpdesk/${ticket.id}`;
  const handlers = await platformHandlers();
  const supers = ticket.hospitalId ? await hospitalSuperAdmins(ticket.hospitalId) : [];
  await notifyMany(
    [...handlers, ...supers].filter((user) => user.id !== actorId),
    {
      hospitalId: ticket.hospitalId,
      href,
      title: "Helpdesk ticket opened",
      body: `${ticket.number}: ${ticket.subject} — tap to reply`,
    },
  );
}

export async function notifyHelpdeskReply(params: {
  ticket: TicketNotify;
  actorId: string;
  actorRole: AppRole;
  preview: string;
}) {
  const href = `/helpdesk/${params.ticket.id}`;
  const preview = params.preview.slice(0, 140);
  const fromHelpdesk = canHandleHelpdesk(params.actorRole);

  if (fromHelpdesk) {
    const recipients: Array<{ id: string; hospitalId?: string | null }> = [];
    if (params.ticket.createdById !== params.actorId) {
      const creator = await prisma.appUser.findUnique({
        where: { id: params.ticket.createdById },
        select: { id: true, hospitalId: true },
      });
      if (creator) recipients.push(creator);
    }
    if (params.ticket.hospitalId) {
      recipients.push(...(await hospitalSuperAdmins(params.ticket.hospitalId)));
    }
    await notifyMany(recipients.filter((user) => user.id !== params.actorId), {
      hospitalId: params.ticket.hospitalId,
      href,
      title: "Helpdesk replied",
      body: `${params.ticket.number} · ${prettyTicketStatus(params.ticket.status)}: ${preview}`,
    });
    await pushTicketLiveUpdate(params.ticket, params.actorId);
    return;
  }

  const handlers = await platformHandlers();
  const assigned = params.ticket.assignedToId
    ? await prisma.appUser.findUnique({
        where: { id: params.ticket.assignedToId },
        select: { id: true, hospitalId: true },
      })
    : null;
  const replyWatchers = [...(assigned ? [assigned] : []), ...handlers].filter((user) => user.id !== params.actorId);
  await notifyMany(replyWatchers, {
    hospitalId: params.ticket.hospitalId,
    href,
    title: "Helpdesk request updated",
    body: `${params.ticket.number} · ${prettyTicketStatus(params.ticket.status)}: ${preview}`,
  });
  await pushTicketLiveUpdate(params.ticket, params.actorId);
}
