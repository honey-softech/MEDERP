"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { REALTIME_EVENTS, type HelpdeskTicketUpdate } from "@/lib/realtime-events";
import { statusBadgeClass, prettyTicketStatus } from "@/lib/helpdesk-options";
import type { HelpdeskTicketStatus } from "@prisma/client";
import { io } from "socket.io-client";

function socketUrl() {
  return process.env.NEXT_PUBLIC_SOCKET_URL || undefined;
}

export function HelpdeskTicketHeader({
  ticketId,
  subject,
  initialStatus,
  category,
  priority,
  hospitalName,
  createdBy,
  assignedTo,
}: {
  ticketId: string;
  subject: string;
  initialStatus: HelpdeskTicketStatus;
  category: string;
  priority: string;
  hospitalName?: string | null;
  createdBy: string;
  assignedTo?: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  useEffect(() => {
    const socket = io(socketUrl(), {
      path: "/socket.io",
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    socket.on(REALTIME_EVENTS.helpdeskTicket, (payload: HelpdeskTicketUpdate) => {
      if (payload.ticketId !== ticketId) return;
      setStatus(payload.status as HelpdeskTicketStatus);
      router.refresh();
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [router, ticketId]);

  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="text-lg font-semibold">{subject}</h3>
        <span
          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(status)}`}
        >
          {prettyTicketStatus(status)}
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-500">
        {category} · {priority.toLowerCase()} priority
        {hospitalName ? ` · ${hospitalName}` : ""} · opened by {createdBy}
        {assignedTo ? ` · assigned to ${assignedTo}` : ""}
      </p>
    </section>
  );
}
