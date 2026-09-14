import type { AppUser, HelpdeskTicketPriority, HelpdeskTicketStatus, Prisma } from "@prisma/client";
import { ticketVisibleWhere } from "@/lib/helpdesk";

export type HelpdeskQueueView =
  | "needs-action"
  | "mine"
  | "unassigned"
  | "breaching"
  | "escalated"
  | "waiting"
  | "recent"
  | "all";

export const HELPDESK_QUEUE_VIEWS: Array<{ value: HelpdeskQueueView; label: string }> = [
  { value: "needs-action", label: "Needs action" },
  { value: "mine", label: "Mine" },
  { value: "unassigned", label: "Unassigned" },
  { value: "breaching", label: "Breaching SLA" },
  { value: "escalated", label: "Escalated" },
  { value: "waiting", label: "Waiting reply" },
  { value: "recent", label: "Recent" },
  { value: "all", label: "All" },
];

const NON_TERMINAL: HelpdeskTicketStatus[] = ["OPEN", "IN_PROGRESS", "WAITING_REPLY", "ESCALATED"];
const NEEDS_ACTION: HelpdeskTicketStatus[] = ["OPEN", "IN_PROGRESS", "ESCALATED"];

const PRIORITY_ORDER: HelpdeskTicketPriority[] = ["URGENT", "HIGH", "NORMAL", "LOW"];

export type TicketQueryParams = {
  view?: string | null;
  q?: string | null;
  status?: string | null;
  priority?: string | null;
  category?: string | null;
  assignedToId?: string | null;
  hospitalId?: string | null;
  page?: string | number | null;
  pageSize?: number;
};

function viewWhere(view: HelpdeskQueueView, userId: string, now: Date): Prisma.HelpdeskTicketWhereInput {
  switch (view) {
    case "needs-action":
      return { status: { in: NEEDS_ACTION } };
    case "mine":
      return { assignedToId: userId, status: { in: NON_TERMINAL } };
    case "unassigned":
      return { assignedToId: null, status: { in: NON_TERMINAL } };
    case "breaching":
      return {
        OR: [
          { firstResponseAt: null, firstResponseDueAt: { lt: now }, status: { in: NON_TERMINAL } },
          {
            resolvedAt: null,
            resolutionDueAt: { lt: now },
            status: { in: ["OPEN", "IN_PROGRESS", "WAITING_REPLY", "ESCALATED"] },
          },
        ],
      };
    case "escalated":
      return { status: "ESCALATED" };
    case "waiting":
      return { status: "WAITING_REPLY" };
    case "recent":
      return {};
    case "all":
    default:
      return {};
  }
}

function parseView(raw: string | null | undefined): HelpdeskQueueView {
  const value = String(raw ?? "needs-action");
  if (HELPDESK_QUEUE_VIEWS.some((item) => item.value === value)) {
    return value as HelpdeskQueueView;
  }
  return "needs-action";
}

export function buildTicketQuery(
  user: Pick<AppUser, "id" | "role" | "hospitalId">,
  params: TicketQueryParams,
) {
  const view = parseView(params.view);
  const pageSize = Math.min(Math.max(params.pageSize ?? 50, 1), 100);
  const page = Math.max(Number(params.page ?? 1) || 1, 1);
  const now = new Date();

  const and: Prisma.HelpdeskTicketWhereInput[] = [ticketVisibleWhere(user), viewWhere(view, user.id, now)];

  const q = String(params.q ?? "").trim();
  if (q.length >= 2) {
    and.push({
      OR: [
        { number: { contains: q, mode: "insensitive" } },
        { subject: { contains: q, mode: "insensitive" } },
        { contactName: { contains: q, mode: "insensitive" } },
        { contactMobile: { contains: q, mode: "insensitive" } },
        { hospital: { name: { contains: q, mode: "insensitive" } } },
      ],
    });
  }

  const status = String(params.status ?? "").trim().toUpperCase();
  if (status && (NON_TERMINAL as string[]).concat(["RESOLVED", "CLOSED"]).includes(status)) {
    and.push({ status: status as HelpdeskTicketStatus });
  }

  const priority = String(params.priority ?? "").trim().toUpperCase();
  if (priority && PRIORITY_ORDER.includes(priority as HelpdeskTicketPriority)) {
    and.push({ priority: priority as HelpdeskTicketPriority });
  }

  const category = String(params.category ?? "").trim().toUpperCase();
  if (category) and.push({ category });

  const assignedToId = String(params.assignedToId ?? "").trim();
  if (assignedToId === "none") and.push({ assignedToId: null });
  else if (assignedToId) and.push({ assignedToId });

  const hospitalId = String(params.hospitalId ?? "").trim();
  if (hospitalId === "none") and.push({ hospitalId: null });
  else if (hospitalId) and.push({ hospitalId });

  const where: Prisma.HelpdeskTicketWhereInput = { AND: and };

  const orderBy: Prisma.HelpdeskTicketOrderByWithRelationInput[] =
    view === "recent"
      ? [{ updatedAt: "desc" }]
      : [
          { priority: "desc" },
          { firstResponseDueAt: { sort: "asc", nulls: "last" } },
          { updatedAt: "desc" },
        ];

  return {
    view,
    where,
    orderBy,
    skip: (page - 1) * pageSize,
    take: pageSize,
    page,
    pageSize,
  };
}

/** Shared count predicates for queue tabs (visibility already applied by caller). */
export function viewCountWhere(view: HelpdeskQueueView, userId: string, now = new Date()) {
  return viewWhere(view, userId, now);
}
