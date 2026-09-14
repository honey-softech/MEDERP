"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthShell, buttonClass, fieldClass, secondaryButtonClass } from "@/components/auth-shell";
import { prettyTicketStatus } from "@/lib/helpdesk-options";

type PublicMessage = {
  id: string;
  body: string;
  kind: string;
  createdAt: string;
  author: string;
  authorRole: string;
};

type PublicTicket = {
  id: string;
  number: string;
  subject: string;
  status: string;
  priority: string;
  category: string;
  hospitalName: string | null;
  updatedAt: string;
  messages: PublicMessage[];
};

export default function HelpStatusPage() {
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [tickets, setTickets] = useState<PublicTicket[] | null>(null);
  const [statusToken, setStatusToken] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function requestOtp(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    setMessage("");
    const response = await fetch("/api/public/help-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "request-otp", mobile }),
    });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not send OTP.");
      return;
    }
    setOtpSent(true);
    setMessage(data.message ?? "OTP sent if that mobile is registered.");
  }

  async function fetchTickets(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    setMessage("");
    const response = await fetch("/api/public/help-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "fetch", mobile, otp }),
    });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not load tickets.");
      return;
    }
    setTickets(Array.isArray(data.tickets) ? data.tickets : []);
    setStatusToken(typeof data.statusToken === "string" ? data.statusToken : "");
    setSelectedId(data.tickets?.[0]?.id ?? null);
  }

  async function sendReply(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedId) return;
    setPending(true);
    setError("");
    const response = await fetch("/api/public/help-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "reply", mobile, statusToken, ticketId: selectedId, body: reply }),
    });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not send reply.");
      return;
    }
    setReply("");
    setMessage("Reply sent.");
    // Refresh list with same OTP session — may fail if OTP already consumed; keep local update
    setTickets((current) =>
      (current ?? []).map((ticket) =>
        ticket.id === selectedId
          ? {
              ...ticket,
              status: data.ticket?.status ?? ticket.status,
              messages: [
                ...ticket.messages,
                {
                  id: `local-${Date.now()}`,
                  body: reply,
                  kind: "PUBLIC",
                  createdAt: new Date().toISOString(),
                  author: "You",
                  authorRole: "REQUESTER",
                },
              ],
            }
          : ticket,
      ),
    );
  }

  const selected = tickets?.find((ticket) => ticket.id === selectedId) ?? null;

  return (
    <AuthShell
      title="Check helpdesk status"
      subtitle="Verify your registered mobile to see tickets you opened from Contact support or while locked out."
      wide
    >
      <p className="mb-4 text-sm text-slate-500">
        <Link href="/help" className="font-medium text-teal-700 hover:underline">
          Open a new request
        </Link>
        {" · "}
        <Link href="/login" className="font-medium text-teal-700 hover:underline">
          Back to login
        </Link>
      </p>

      {!tickets ? (
        <form
          onSubmit={otpSent ? fetchTickets : requestOtp}
          className="mx-auto max-w-md space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <label className="block text-sm font-medium text-slate-700">
            Mobile
            <input
              className={fieldClass}
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              required
              inputMode="numeric"
            />
          </label>
          {otpSent ? (
            <label className="block text-sm font-medium text-slate-700">
              OTP
              <input
                className={fieldClass}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
                inputMode="numeric"
              />
            </label>
          ) : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {message ? <p className="text-sm text-teal-700">{message}</p> : null}
          <button className={buttonClass} type="submit" disabled={pending}>
            {pending ? "Please wait…" : otpSent ? "View tickets" : "Send OTP"}
          </button>
          {otpSent ? (
            <button
              type="button"
              className={secondaryButtonClass}
              disabled={pending}
              onClick={() => void requestOtp({ preventDefault() {} } as React.FormEvent)}
            >
              Resend OTP
            </button>
          ) : null}
        </form>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
          <ul className="space-y-2">
            {tickets.length === 0 ? (
              <li className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
                No helpdesk tickets found for this mobile.
              </li>
            ) : (
              tickets.map((ticket) => (
                <li key={ticket.id}>
                  <button
                    type="button"
                    className={`w-full rounded-xl border px-3 py-3 text-left ${
                      selectedId === ticket.id
                        ? "border-teal-500 bg-teal-50"
                        : "border-slate-200 bg-white hover:border-teal-200"
                    }`}
                    onClick={() => setSelectedId(ticket.id)}
                  >
                    <p className="font-mono text-xs text-slate-500">{ticket.number}</p>
                    <p className="font-medium text-slate-900">{ticket.subject}</p>
                    <p className="text-xs text-slate-500">{prettyTicketStatus(ticket.status)}</p>
                  </button>
                </li>
              ))
            )}
          </ul>

          {selected ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">{selected.subject}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {selected.number} · {prettyTicketStatus(selected.status)}
                {selected.hospitalName ? ` · ${selected.hospitalName}` : ""}
              </p>
              <ol className="mt-4 space-y-3">
                {selected.messages.map((item) => (
                  <li key={item.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                    <p className="text-xs text-slate-500">
                      {item.kind === "SYSTEM" ? "System · " : ""}
                      {item.author} · {new Date(item.createdAt).toLocaleString("en-IN")}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{item.body}</p>
                  </li>
                ))}
              </ol>
              {selected.status !== "CLOSED" ? (
                <form onSubmit={sendReply} className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                  <label className="block text-sm font-medium text-slate-700">
                    Reply
                    <textarea
                      className={fieldClass}
                      rows={3}
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      required
                    />
                  </label>
                  {error ? <p className="text-sm text-red-600">{error}</p> : null}
                  {message ? <p className="text-sm text-teal-700">{message}</p> : null}
                  <button className={buttonClass} type="submit" disabled={pending}>
                    {pending ? "Sending…" : "Send reply"}
                  </button>
                </form>
              ) : (
                <p className="mt-4 text-sm text-slate-500">This request is closed.</p>
              )}
            </section>
          ) : null}
        </div>
      )}
    </AuthShell>
  );
}
