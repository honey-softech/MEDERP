import type { HelpdeskTicketPriority } from "@prisma/client";

export const SLA_MINUTES = {
  LOW: { firstResponse: 8 * 60, resolution: 5 * 24 * 60 },
  NORMAL: { firstResponse: 4 * 60, resolution: 2 * 24 * 60 },
  HIGH: { firstResponse: 60, resolution: 24 * 60 },
  URGENT: { firstResponse: 30, resolution: 8 * 60 },
} as const;

export function slaDueDates(priority: HelpdeskTicketPriority, from: Date = new Date()) {
  const table = SLA_MINUTES[priority] ?? SLA_MINUTES.NORMAL;
  return {
    firstResponseDueAt: new Date(from.getTime() + table.firstResponse * 60_000),
    resolutionDueAt: new Date(from.getTime() + table.resolution * 60_000),
  };
}

export type SlaTone = "ok" | "soon" | "breached" | "met";

export type SlaState = {
  label: string;
  tone: SlaTone;
  dueAt: Date | null;
  kind: "firstResponse" | "resolution" | "none";
};

function formatRemaining(ms: number) {
  const abs = Math.abs(ms);
  const mins = Math.round(abs / 60_000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}

/** Active SLA chip: first-response clock until answered, then resolution clock until resolved. */
export function slaState(ticket: {
  status: string;
  firstResponseDueAt?: Date | string | null;
  resolutionDueAt?: Date | string | null;
  firstResponseAt?: Date | string | null;
  resolvedAt?: Date | string | null;
  closedAt?: Date | string | null;
}): SlaState {
  if (ticket.status === "CLOSED" || ticket.status === "RESOLVED") {
    return { label: ticket.status === "CLOSED" ? "Closed" : "Resolved", tone: "met", dueAt: null, kind: "none" };
  }

  const now = Date.now();
  const firstDue = ticket.firstResponseDueAt ? new Date(ticket.firstResponseDueAt).getTime() : null;
  const resDue = ticket.resolutionDueAt ? new Date(ticket.resolutionDueAt).getTime() : null;

  if (!ticket.firstResponseAt && firstDue) {
    const delta = firstDue - now;
    if (delta < 0) {
      return {
        label: `Reply breached ${formatRemaining(delta)} ago`,
        tone: "breached",
        dueAt: new Date(firstDue),
        kind: "firstResponse",
      };
    }
    if (delta < 30 * 60_000) {
      return {
        label: `Reply due in ${formatRemaining(delta)}`,
        tone: "soon",
        dueAt: new Date(firstDue),
        kind: "firstResponse",
      };
    }
    return {
      label: `Reply due in ${formatRemaining(delta)}`,
      tone: "ok",
      dueAt: new Date(firstDue),
      kind: "firstResponse",
    };
  }

  if (!ticket.resolvedAt && resDue) {
    const delta = resDue - now;
    if (delta < 0) {
      return {
        label: `Resolve breached ${formatRemaining(delta)} ago`,
        tone: "breached",
        dueAt: new Date(resDue),
        kind: "resolution",
      };
    }
    if (delta < 2 * 60 * 60_000) {
      return {
        label: `Resolve due in ${formatRemaining(delta)}`,
        tone: "soon",
        dueAt: new Date(resDue),
        kind: "resolution",
      };
    }
    return {
      label: `Resolve due in ${formatRemaining(delta)}`,
      tone: "ok",
      dueAt: new Date(resDue),
      kind: "resolution",
    };
  }

  return { label: "On track", tone: "ok", dueAt: null, kind: "none" };
}
