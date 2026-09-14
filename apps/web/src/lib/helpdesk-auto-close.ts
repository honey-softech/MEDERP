import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

const AUTO_CLOSE_MS = 3 * 24 * 60 * 60 * 1000;
const SWEEP_INTERVAL_MS = 15 * 60 * 1000;
const BATCH = 50;

let started = false;

/** Close RESOLVED tickets with no requester activity for 3 days. */
export async function autoCloseResolvedTickets() {
  const cutoff = new Date(Date.now() - AUTO_CLOSE_MS);
  const tickets = await prisma.helpdeskTicket.findMany({
    where: {
      status: "RESOLVED",
      resolvedAt: { lte: cutoff },
      OR: [{ lastRequesterReplyAt: null }, { lastRequesterReplyAt: { lte: cutoff } }],
    },
    take: BATCH,
    select: {
      id: true,
      number: true,
      hospitalId: true,
      assignedToId: true,
      createdById: true,
    },
  });

  for (const ticket of tickets) {
    const authorId = ticket.assignedToId ?? ticket.createdById;
    if (!authorId) {
      // Need an author for HelpdeskMessage — skip if somehow orphaned.
      await prisma.helpdeskTicket.update({
        where: { id: ticket.id },
        data: { status: "CLOSED", closedAt: new Date() },
      });
    } else {
      await prisma.$transaction([
        prisma.helpdeskTicket.update({
          where: { id: ticket.id },
          data: { status: "CLOSED", closedAt: new Date() },
        }),
        prisma.helpdeskMessage.create({
          data: {
            ticketId: ticket.id,
            authorId,
            kind: "SYSTEM",
            body: "Automatically closed after 3 days with no further replies.",
          },
        }),
      ]);
    }

    await writeAuditLog({
      hospitalId: ticket.hospitalId,
      actorUserId: null,
      actorUsername: "system",
      actorRole: null,
      action: "HELPDESK_TICKET_AUTO_CLOSED",
      entity: "HelpdeskTicket",
      entityId: ticket.id,
      summary: `Helpdesk ${ticket.number} auto-closed after idle resolution period.`,
    });
  }

  return tickets.length;
}

export function startHelpdeskAutoCloseWorker() {
  if (started) return;
  started = true;
  const tick = () => {
    void autoCloseResolvedTickets().catch((error) => {
      console.error("Helpdesk auto-close failed:", error);
    });
  };
  tick();
  setInterval(tick, SWEEP_INTERVAL_MS);
}
