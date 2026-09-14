"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fieldClass, secondaryButtonClass } from "@/components/auth-shell";

type Agent = {
  id: string;
  username: string;
  displayName: string;
  openCount: number;
};

export function HelpdeskAssignPicker({
  ticketId,
  currentUserId,
  assignedToId,
}: {
  ticketId: string;
  currentUserId: string;
  assignedToId: string | null;
}) {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [value, setValue] = useState(assignedToId ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setValue(assignedToId ?? "");
  }, [assignedToId]);

  useEffect(() => {
    void fetch("/api/helpdesk/agents")
      .then(async (response) => {
        const data = (await response.json()) as { agents?: Agent[] };
        if (response.ok) setAgents(Array.isArray(data.agents) ? data.agents : []);
      })
      .catch(() => undefined);
  }, []);

  async function save(next: string | null) {
    setPending(true);
    setError("");
    const response = await fetch(`/api/helpdesk/tickets/${ticketId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignedToId: next }),
    });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not update assignee.");
      return;
    }
    setValue(next ?? "");
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Assignee</h3>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="block min-w-48 flex-1 text-xs font-medium text-slate-600">
          Agent
          <select
            className={fieldClass}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={pending}
          >
            <option value="">Unassigned</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.displayName} ({agent.openCount} open)
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={secondaryButtonClass}
          disabled={pending}
          onClick={() => void save(value || null)}
        >
          Save
        </button>
        <button
          type="button"
          className={secondaryButtonClass}
          disabled={pending}
          onClick={() => void save(currentUserId)}
        >
          Assign to me
        </button>
        <button
          type="button"
          className={secondaryButtonClass}
          disabled={pending || !value}
          onClick={() => void save(null)}
        >
          Unassign
        </button>
      </div>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
