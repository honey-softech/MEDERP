import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { HelpdeskTicketForm } from "@/components/helpdesk-ticket-form";
import { FilterableTable } from "@/components/filterable-table";
import { getCurrentUser } from "@/lib/auth";
import { canHandleHelpdesk, prettyTicketStatus, ticketVisibleWhere } from "@/lib/helpdesk";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function HelpdeskPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const tickets = await prisma.helpdeskTicket.findMany({
    where: ticketVisibleWhere(user),
    orderBy: { updatedAt: "desc" },
    include: {
      hospital: { select: { name: true, code: true } },
      createdBy: { select: { username: true } },
    },
  });

  const handler = canHandleHelpdesk(user.role);

  return (
    <AppShell title="Helpdesk">
      <p className="mb-6 max-w-2xl text-sm text-slate-500">
        {handler
          ? "Hospital admins and staff raise requests here. Reply to notify them instantly on web and mobile."
          : "Reach MedERP support from here. Replies from helpdesk show up as a notification on this device."}
      </p>
      <div className={handler ? "space-y-4" : "grid gap-8 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]"}>
        {handler ? null : <HelpdeskTicketForm />}
        <section className="min-w-0">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="font-semibold">{handler ? "All requests" : "Your requests"}</h3>
            {handler ? (
              <Link href="/helpdesk/new" className="text-sm font-medium text-teal-700 hover:underline">
                Open a request
              </Link>
            ) : null}
          </div>
          <FilterableTable
            empty="No helpdesk requests yet."
            rows={tickets.map((ticket) => ({
              id: ticket.id,
              number: ticket.number,
              subject: ticket.subject,
              hospital: ticket.hospital ? `${ticket.hospital.name}` : "Platform",
              from: ticket.createdBy.username,
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
