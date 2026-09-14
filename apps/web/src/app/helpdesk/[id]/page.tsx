import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { HelpdeskAssignPicker } from "@/components/helpdesk-assign-picker";
import { HelpdeskDiagnosisPanel } from "@/components/helpdesk-diagnosis-panel";
import { HelpdeskEscalatePanel } from "@/components/helpdesk-escalate-panel";
import { HelpdeskSlaChip } from "@/components/helpdesk-sla-chip";
import { HelpdeskSupportPanel } from "@/components/helpdesk-support-panel";
import { HelpdeskThread } from "@/components/helpdesk-thread";
import { HelpdeskTicketHeader } from "@/components/helpdesk-ticket-header";
import { getCurrentUser } from "@/lib/auth";
import { canHandleHelpdesk, ticketVisibleWhere } from "@/lib/helpdesk";
import { slaState } from "@/lib/helpdesk-sla";
import { prisma } from "@/lib/prisma";
import { canRunSupportAction } from "@/lib/support-actions";

type Ctx = { params: Promise<{ id: string }> };

export default async function HelpdeskTicketPage({ params }: Ctx) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const handler = canHandleHelpdesk(user.role);

  const ticket = await prisma.helpdeskTicket.findFirst({
    where: { id, ...ticketVisibleWhere(user) },
    include: {
      hospital: {
        select: {
          name: true,
          code: true,
          isActive: true,
          subscriptionTier: true,
          trialEndsAt: true,
          extraStaffSlots: true,
          includedStaffSlots: true,
          unlimitedStaffSeats: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          username: true,
          role: true,
          mobile: true,
          isActive: true,
          isVerified: true,
        },
      },
      assignedTo: { select: { id: true, username: true } },
      escalatedBy: { select: { username: true } },
      messages: {
        where: handler ? undefined : { kind: { in: ["PUBLIC", "SYSTEM"] } },
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, username: true, role: true } } },
      },
    },
  });
  if (!ticket) notFound();

  const showSupportTools = canRunSupportAction(user.role);
  const showEscalate = handler;
  const sla = slaState(ticket);
  const requesterName =
    ticket.createdBy?.username ?? ticket.contactName ?? ticket.contactMobile ?? "Unknown";

  return (
    <AppShell title={ticket.number}>
      <p className="mb-4 text-sm text-slate-500">
        <Link href="/helpdesk" className="font-medium text-teal-700 hover:underline">
          Back to helpdesk
        </Link>
      </p>
      <div className="mb-4">
        <HelpdeskSlaChip label={sla.label} tone={sla.tone} />
      </div>
      <HelpdeskTicketHeader
        ticketId={ticket.id}
        subject={ticket.subject}
        initialStatus={ticket.status}
        category={ticket.category}
        priority={ticket.priority}
        hospitalName={ticket.hospital?.name}
        createdBy={requesterName}
        assignedTo={ticket.assignedTo?.username}
      />
      {ticket.status === "ESCALATED" && ticket.escalationReason ? (
        <section className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-950">
          <p className="font-semibold">Escalation reason</p>
          <p className="mt-1 whitespace-pre-wrap">{ticket.escalationReason}</p>
          <p className="mt-2 text-xs text-red-800">
            {ticket.escalatedBy?.username ? `By ${ticket.escalatedBy.username}` : "Escalated"}
            {ticket.escalatedAt
              ? ` · ${new Date(ticket.escalatedAt).toLocaleString("en-IN")}`
              : ""}
          </p>
        </section>
      ) : null}
      {handler ? (
        <div className="mb-6">
          <HelpdeskAssignPicker
            ticketId={ticket.id}
            currentUserId={user.id}
            assignedToId={ticket.assignedToId}
          />
        </div>
      ) : null}
      {showSupportTools ? (
        <>
          <HelpdeskDiagnosisPanel
            createdBy={ticket.createdBy}
            contactName={ticket.contactName}
            contactMobile={ticket.contactMobile}
            hospital={ticket.hospital}
          />
          <div className="mb-6 grid gap-4 xl:grid-cols-2">
            <HelpdeskSupportPanel
              ticketId={ticket.id}
              targetUserId={ticket.createdBy?.id}
              targetUsername={ticket.createdBy?.username}
              targetMobile={ticket.createdBy?.mobile ?? ticket.contactMobile}
            />
            {showEscalate ? <HelpdeskEscalatePanel ticketId={ticket.id} status={ticket.status} /> : null}
          </div>
        </>
      ) : showEscalate ? (
        <div className="mb-6">
          <HelpdeskEscalatePanel ticketId={ticket.id} status={ticket.status} />
        </div>
      ) : null}
      <HelpdeskThread
        ticketId={ticket.id}
        currentUserId={user.id}
        canManage={handler}
        status={ticket.status}
        messages={ticket.messages}
        ticketNumber={ticket.number}
        requesterName={requesterName}
        agentName={user.username}
        hospitalName={ticket.hospital?.name ?? undefined}
      />
    </AppShell>
  );
}
