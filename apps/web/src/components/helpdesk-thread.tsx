"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClass, fieldClass, secondaryButtonClass } from "@/components/auth-shell";
import { renderCannedReply } from "@/lib/helpdesk-canned";
import type { HelpdeskMessageKind, HelpdeskTicketStatus } from "@prisma/client";

type Message = {
  id: string;
  body: string;
  kind?: HelpdeskMessageKind | string;
  createdAt: string | Date;
  author: { id: string; username: string; role: string };
};

type Canned = { id: string; title: string; body: string; category: string | null };

const STATUS_ACTIONS: HelpdeskTicketStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING_REPLY",
  "ESCALATED",
  "RESOLVED",
  "CLOSED",
];

export function HelpdeskThread({
  ticketId,
  currentUserId,
  canManage,
  status,
  messages,
  ticketNumber,
  requesterName,
  agentName,
  hospitalName,
}: {
  ticketId: string;
  currentUserId: string;
  canManage: boolean;
  status: HelpdeskTicketStatus;
  messages: Message[];
  ticketNumber?: string;
  requesterName?: string;
  agentName?: string;
  hospitalName?: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<"PUBLIC" | "INTERNAL">("PUBLIC");
  const [liveStatus, setLiveStatus] = useState(status);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [canned, setCanned] = useState<Canned[]>([]);
  const [cannedId, setCannedId] = useState("");

  useEffect(() => {
    setLiveStatus(status);
  }, [status]);

  useEffect(() => {
    if (!canManage) return;
    void fetch("/api/helpdesk/canned-replies")
      .then(async (response) => {
        const data = (await response.json()) as { replies?: Canned[] };
        if (response.ok) setCanned(Array.isArray(data.replies) ? data.replies : []);
      })
      .catch(() => undefined);
  }, [canManage]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    const response = await fetch(`/api/helpdesk/tickets/${ticketId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, kind: canManage ? kind : "PUBLIC" }),
    });
    const data = await response.json();
    if (!response.ok) {
      setPending(false);
      setError(data.error ?? "Could not send reply.");
      return;
    }
    setBody("");
    setPending(false);
    router.refresh();
  }

  async function setStatus(next: HelpdeskTicketStatus) {
    setPending(true);
    const response = await fetch(`/api/helpdesk/tickets/${ticketId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    const data = await response.json();
    if (response.ok && data.ticket?.status) {
      setLiveStatus(data.ticket.status as HelpdeskTicketStatus);
    }
    setPending(false);
    router.refresh();
  }

  async function applyCanned(id: string) {
    const item = canned.find((row) => row.id === id);
    if (!item) return;
    setCannedId(id);
    setBody(
      renderCannedReply(item.body, {
        ticket_number: ticketNumber,
        requester_name: requesterName,
        agent_name: agentName,
        hospital_name: hospitalName,
      }),
    );
    setKind("PUBLIC");
    void fetch(`/api/helpdesk/canned-replies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bumpUse: true }),
    }).catch(() => undefined);
  }

  return (
    <div className="space-y-6">
      <ol className="space-y-3">
        {messages.map((item) => {
          const mine = item.author.id === currentUserId;
          const messageKind = (item.kind ?? "PUBLIC") as string;
          const isInternal = messageKind === "INTERNAL";
          const isSystem = messageKind === "SYSTEM";
          return (
            <li
              key={item.id}
              className={`max-w-xl rounded-2xl border px-4 py-3 ${
                isInternal
                  ? "border-amber-200 bg-amber-50"
                  : isSystem
                    ? "border-slate-200 bg-slate-50"
                    : mine
                      ? "ml-auto border-teal-100 bg-teal-50"
                      : "border-slate-200 bg-white"
              }`}
            >
              <p className="text-xs font-medium text-slate-500">
                {isInternal ? (
                  <span className="mr-1 inline-flex items-center rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-950">
                    Internal
                  </span>
                ) : null}
                {isSystem ? (
                  <span className="mr-1 inline-flex items-center rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-700">
                    System
                  </span>
                ) : null}
                {item.author.username} · {item.author.role.replace(/_/g, " ")} ·{" "}
                {new Date(item.createdAt).toLocaleString("en-IN")}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{item.body}</p>
            </li>
          );
        })}
      </ol>

      {liveStatus === "CLOSED" ? (
        <p className="text-sm text-slate-500">This request is closed.</p>
      ) : liveStatus === "RESOLVED" && !canManage ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Marked resolved by helpdesk. Reply here if you still need assistance.
        </p>
      ) : (
        <form onSubmit={send} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          {canManage ? (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  kind === "PUBLIC"
                    ? "border-teal-600 bg-teal-600 text-white"
                    : "border-slate-200 bg-white text-slate-600"
                }`}
                onClick={() => setKind("PUBLIC")}
              >
                Reply
              </button>
              <button
                type="button"
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  kind === "INTERNAL"
                    ? "border-amber-600 bg-amber-500 text-white"
                    : "border-slate-200 bg-white text-slate-600"
                }`}
                onClick={() => setKind("INTERNAL")}
              >
                Internal note
              </button>
              {canned.length > 0 && kind === "PUBLIC" ? (
                <label className="ml-auto block min-w-48 text-xs font-medium text-slate-600">
                  Canned reply
                  <select
                    className={fieldClass}
                    value={cannedId}
                    onChange={(e) => void applyCanned(e.target.value)}
                  >
                    <option value="">Insert…</option>
                    {canned.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          ) : null}
          <label className="block text-sm font-medium text-slate-700">
            {kind === "INTERNAL" ? "Internal note (not visible to requester)" : "Reply"}
            <textarea
              className={fieldClass}
              rows={4}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              required
            />
          </label>
          {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
          <button className={`${buttonClass} mt-3`} type="submit" disabled={pending}>
            {pending ? "Sending…" : kind === "INTERNAL" ? "Add note" : "Send reply"}
          </button>
        </form>
      )}

      {canManage ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-2 text-sm font-medium text-slate-700">Status</p>
          <div className="flex flex-wrap gap-2">
            {STATUS_ACTIONS.map((item) => (
              <button
                key={item}
                type="button"
                disabled={pending || liveStatus === item}
                className={`${secondaryButtonClass} ${
                  liveStatus === item ? "border-teal-600 bg-teal-50 text-teal-900" : ""
                }`}
                onClick={() => void setStatus(item)}
              >
                {item.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
