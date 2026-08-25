import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { HelpdeskThread } from "@/components/helpdesk-thread";
import { HelpdeskTicketHeader } from "@/components/helpdesk-ticket-header";
import { getCurrentUser } from "@/lib/auth";
import { canHandleHelpdesk, ticketVisibleWhere } from "@/lib/helpdesk";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

export default async function HelpdeskTicketPage({ params }: Ctx) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;

  const ticket = await prisma.helpdeskTicket.findFirst({
    where: { id, ...ticketVisibleWhere(user) },
    include: {
      hospital: { select: { name: true, code: true } },
      createdBy: { select: { username: true, role: true } },
      assignedTo: { select: { username: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, username: true, role: true } } },
      },
    },
  });
  if (!ticket) notFound();

  return (
    <AppShell title={ticket.number}>
      <p className="mb-4 text-sm text-slate-500">
        <Link href="/helpdesk" className="font-medium text-teal-700 hover:underline">
          Back to helpdesk
        </Link>
      </p>
      <HelpdeskTicketHeader
        ticketId={ticket.id}
        subject={ticket.subject}
        initialStatus={ticket.status}
        category={ticket.category}
        priority={ticket.priority}
        hospitalName={ticket.hospital?.name}
        createdBy={ticket.createdBy.username}
        assignedTo={ticket.assignedTo?.username}
      />
      <HelpdeskThread
        ticketId={ticket.id}
        currentUserId={user.id}
        canManage={canHandleHelpdesk(user.role)}
        status={ticket.status}
        messages={ticket.messages}
      />
    </AppShell>
  );
}
