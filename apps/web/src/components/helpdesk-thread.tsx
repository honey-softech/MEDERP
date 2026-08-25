"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClass, fieldClass, secondaryButtonClass } from "@/components/auth-shell";
import type { HelpdeskTicketStatus } from "@prisma/client";

type Message = {
  id: string;
  body: string;
  createdAt: string | Date;
  author: { id: string; username: string; role: string };
};

export function HelpdeskThread({
  ticketId,
  currentUserId,
  canManage,
  status,
  messages,
}: {
  ticketId: string;
  currentUserId: string;
  canManage: boolean;
  status: HelpdeskTicketStatus;
  messages: Message[];
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [nextStatus, setNextStatus] = useState(status);
  const [liveStatus, setLiveStatus] = useState(status);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setNextStatus(status);
    setLiveStatus(status);
  }, [status]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    const response = await fetch(`/api/helpdesk/tickets/${ticketId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
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

  async function saveStatus() {
    setPending(true);
    const response = await fetch(`/api/helpdesk/tickets/${ticketId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    const data = await response.json();
    if (response.ok && data.ticket?.status) {
      const updated = data.ticket.status as HelpdeskTicketStatus;
      setLiveStatus(updated);
      setNextStatus(updated);
    }
    setPending(false);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <ol className="space-y-3">
        {messages.map((item) => {
          const mine = item.author.id === currentUserId;
          return (
            <li
              key={item.id}
              className={`max-w-xl rounded-2xl border px-4 py-3 ${
                mine ? "ml-auto border-teal-100 bg-teal-50" : "border-slate-200 bg-white"
              }`}
            >
              <p className="text-xs font-medium text-slate-500">
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
          <label className="block text-sm font-medium text-slate-700">
            Reply
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
            {pending ? "Sending…" : "Send reply"}
          </button>
        </form>
      )}
      {canManage ? (
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4">
          <label className="block min-w-40 flex-1 text-sm font-medium text-slate-700">
            Status
            <select className={fieldClass} value={nextStatus} onChange={(event) => setNextStatus(event.target.value)}>
              {["OPEN", "IN_PROGRESS", "WAITING_REPLY", "RESOLVED", "CLOSED"].map((item) => (
                <option key={item} value={item}>
                  {item.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
          <button className={secondaryButtonClass} type="button" disabled={pending} onClick={() => void saveStatus()}>
            Update status
          </button>
        </div>
      ) : null}
    </div>
  );
}
