"use client";

import { useState } from "react";
import { fieldClass, secondaryButtonClass } from "@/components/auth-shell";
import { HELPDESK_PRIORITIES } from "@/lib/helpdesk-options";

export function HelpdeskBulkBar({
  ticketIds,
  agents,
  onDone,
}: {
  ticketIds: string[];
  agents: Array<{ id: string; username: string; displayName: string }>;
  onDone: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [assignTo, setAssignTo] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");

  async function run(action: "ASSIGN" | "STATUS" | "PRIORITY", value: string | null) {
    setPending(true);
    setError("");
    const response = await fetch("/api/helpdesk/tickets/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketIds, action, value }),
    });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Bulk update failed.");
      return;
    }
    onDone();
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3">
      <p className="text-sm font-medium text-teal-900">{ticketIds.length} selected</p>
      <label className="block text-xs font-medium text-teal-900">
        Assign
        <select className={fieldClass} value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
          <option value="">Choose…</option>
          <option value="__unassign">Unassign</option>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.displayName}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className={secondaryButtonClass}
        disabled={pending || !assignTo}
        onClick={() => void run("ASSIGN", assignTo === "__unassign" ? null : assignTo)}
      >
        Apply assign
      </button>
      <label className="block text-xs font-medium text-teal-900">
        Status
        <select className={fieldClass} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Choose…</option>
          {["OPEN", "IN_PROGRESS", "WAITING_REPLY", "ESCALATED", "RESOLVED", "CLOSED"].map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className={secondaryButtonClass}
        disabled={pending || !status}
        onClick={() => void run("STATUS", status)}
      >
        Apply status
      </button>
      <label className="block text-xs font-medium text-teal-900">
        Priority
        <select className={fieldClass} value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="">Choose…</option>
          {HELPDESK_PRIORITIES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
          <option value="URGENT">Urgent</option>
        </select>
      </label>
      <button
        type="button"
        className={secondaryButtonClass}
        disabled={pending || !priority}
        onClick={() => void run("PRIORITY", priority)}
      >
        Apply priority
      </button>
      {error ? <p className="w-full text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
