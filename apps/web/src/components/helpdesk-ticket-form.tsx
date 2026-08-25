"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClass, fieldClass } from "@/components/auth-shell";
import { HELPDESK_CATEGORIES, HELPDESK_PRIORITIES } from "@/lib/helpdesk-options";

export function HelpdeskTicketForm() {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("TECHNICAL");
  const [priority, setPriority] = useState("NORMAL");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    const response = await fetch("/api/helpdesk/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, category, priority, body }),
    });
    const data = await response.json();
    if (!response.ok) {
      setPending(false);
      setError(data.error ?? "Could not open request.");
      return;
    }
    router.push(`/helpdesk/${data.ticket.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <label className="block text-sm font-medium text-slate-700">
        Subject
        <input className={fieldClass} value={subject} onChange={(event) => setSubject(event.target.value)} required />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700">
          Category
          <select className={fieldClass} value={category} onChange={(event) => setCategory(event.target.value)}>
            {HELPDESK_CATEGORIES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Priority
          <select className={fieldClass} value={priority} onChange={(event) => setPriority(event.target.value)}>
            {HELPDESK_PRIORITIES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-sm font-medium text-slate-700">
        Describe the issue
        <textarea
          className={fieldClass}
          rows={5}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          required
        />
      </label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button className={buttonClass} type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send to helpdesk"}
      </button>
    </form>
  );
}
