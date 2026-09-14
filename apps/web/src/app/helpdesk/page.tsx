import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { HelpdeskTicketForm } from "@/components/helpdesk-ticket-form";
import { FilterableTable } from "@/components/filterable-table";
import { HelpdeskQueueFilters } from "@/components/helpdesk-queue-filters";
import { HelpdeskQueueTable } from "@/components/helpdesk-queue-table";
import { getCurrentUser } from "@/lib/auth";
import { canHandleHelpdesk, prettyTicketStatus, ticketVisibleWhere } from "@/lib/helpdesk";
import {
  buildTicketQuery,
  HELPDESK_QUEUE_VIEWS,
  type HelpdeskQueueView,
  viewCountWhere,
} from "@/lib/helpdesk-queue";
import { prisma } from "@/lib/prisma";

type Search = { [key: string]: string | string[] | undefined };

export default async function HelpdeskPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const params = await searchParams;
  const handler = canHandleHelpdesk(user.role);

  if (!handler) {
    const tickets = await prisma.helpdeskTicket.findMany({
      where: ticketVisibleWhere(user),
      orderBy: { updatedAt: "desc" },
      include: {
        hospital: { select: { name: true, code: true } },
        createdBy: { select: { username: true } },
      },
    });

    return (
      <AppShell title="Helpdesk">
        <p className="mb-6 max-w-2xl text-sm text-slate-500">
          Reach MedERP support from here. Replies from helpdesk show up as a notification on this device.
        </p>
        <div className="grid gap-8 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <HelpdeskTicketForm />
          <section className="min-w-0">
            <h3 className="mb-4 font-semibold">Your requests</h3>
            <FilterableTable
              empty="No helpdesk requests yet."
              rows={tickets.map((ticket) => ({
                id: ticket.id,
                number: ticket.number,
                subject: ticket.subject,
                hospital: ticket.hospital ? `${ticket.hospital.name}` : "Platform",
                from: ticket.createdBy?.username ?? ticket.contactName ?? ticket.contactMobile ?? "Unknown",
                status: prettyTicketStatus(ticket.status),
                updated: ticket.updatedAt.toLocaleString("en-IN"),
                open: "Open",
                href: `/helpdesk/${ticket.id}`,
              }))}
              columns={[
                { key: "number", header: "ID", className: "font-mono text-xs", hrefKey: "href" },
                { key: "status", header: "Status" },
                { key: "subject", header: "Subject", className: "font-medium", hrefKey: "href" },
                { key: "hospital", header: "Hospital" },
                { key: "from", header: "From" },
                { key: "updated", header: "Updated" },
              ]}
              minWidthClass="min-w-[48rem]"
            />
          </section>
        </div>
      </AppShell>
    );
  }

  const query = buildTicketQuery(user, {
    view: typeof params.view === "string" ? params.view : null,
    q: typeof params.q === "string" ? params.q : null,
    status: typeof params.status === "string" ? params.status : null,
    priority: typeof params.priority === "string" ? params.priority : null,
    category: typeof params.category === "string" ? params.category : null,
    assignedToId: typeof params.assignedToId === "string" ? params.assignedToId : null,
    hospitalId: typeof params.hospitalId === "string" ? params.hospitalId : null,
    page: typeof params.page === "string" ? params.page : null,
  });

  const visibility = ticketVisibleWhere(user);
  const now = new Date();

  const [tickets, total, agents, hospitals, ...countResults] = await Promise.all([
    prisma.helpdeskTicket.findMany({
      where: query.where,
      orderBy: query.orderBy,
      skip: query.skip,
      take: query.take,
      include: {
        hospital: { select: { name: true } },
        createdBy: { select: { username: true } },
        assignedTo: { select: { username: true } },
      },
    }),
    prisma.helpdeskTicket.count({ where: query.where }),
    prisma.appUser.findMany({
      where: { role: { in: ["SOFTWARE_ADMIN", "HELPDESK"] }, isActive: true, isVerified: true },
      select: { id: true, username: true, firstName: true, lastName: true },
      orderBy: { username: "asc" },
    }),
    prisma.hospital.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 200,
    }),
    ...HELPDESK_QUEUE_VIEWS.map((view) =>
      prisma.helpdeskTicket.count({
        where: { AND: [visibility, viewCountWhere(view.value, user.id, now)] },
      }),
    ),
  ]);

  const counts = Object.fromEntries(
    HELPDESK_QUEUE_VIEWS.map((view, index) => [view.value, countResults[index] as number]),
  ) as Record<HelpdeskQueueView, number>;

  const agentOptions = agents.map((agent) => ({
    id: agent.id,
    username: agent.username,
    displayName: [agent.firstName, agent.lastName].filter(Boolean).join(" ").trim() || agent.username,
  }));

  return (
    <AppShell title="Helpdesk">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm text-slate-500">
          Work queue for MedERP support. Use views and SLA chips to pick the next ticket. Internal notes stay
          private to agents.
        </p>
        <div className="flex flex-wrap gap-3 text-sm font-medium">
          <Link href="/helpdesk/canned-replies" className="text-teal-700 hover:underline">
            Canned replies
          </Link>
          <Link href="/helpdesk/new" className="text-teal-700 hover:underline">
            Open a request
          </Link>
        </div>
      </div>

      <Suspense fallback={<p className="text-sm text-slate-500">Loading filters…</p>}>
        <HelpdeskQueueFilters agents={agentOptions} hospitals={hospitals} counts={counts} />
      </Suspense>

      <div className="mt-6">
        <Suspense fallback={<p className="text-sm text-slate-500">Loading queue…</p>}>
          <HelpdeskQueueTable
            page={query.page}
            pageSize={query.pageSize}
            total={total}
            agents={agentOptions}
            rows={tickets.map((ticket) => ({
              id: ticket.id,
              number: ticket.number,
              subject: ticket.subject,
              status: ticket.status,
              priority: ticket.priority,
              category: ticket.category,
              hospital: ticket.hospital?.name ?? "Platform",
              from: ticket.createdBy?.username ?? ticket.contactName ?? ticket.contactMobile ?? "Unknown",
              assignedTo: ticket.assignedTo?.username ?? "—",
              updated: ticket.updatedAt.toLocaleString("en-IN"),
              href: `/helpdesk/${ticket.id}`,
              firstResponseDueAt: ticket.firstResponseDueAt?.toISOString() ?? null,
              resolutionDueAt: ticket.resolutionDueAt?.toISOString() ?? null,
              firstResponseAt: ticket.firstResponseAt?.toISOString() ?? null,
              resolvedAt: ticket.resolvedAt?.toISOString() ?? null,
            }))}
          />
        </Suspense>
      </div>
    </AppShell>
  );
}
