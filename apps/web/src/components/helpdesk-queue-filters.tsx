"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { fieldClass, secondaryButtonClass } from "@/components/auth-shell";
import { HELPDESK_CATEGORIES, HELPDESK_PRIORITIES } from "@/lib/helpdesk-options";
import { HELPDESK_QUEUE_VIEWS, type HelpdeskQueueView } from "@/lib/helpdesk-queue";

type Agent = { id: string; username: string; displayName: string };
type Hospital = { id: string; name: string };

export function HelpdeskQueueFilters({
  agents,
  hospitals,
  counts,
}: {
  agents: Agent[];
  hospitals: Hospital[];
  counts: Record<HelpdeskQueueView, number>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  const push = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (!value) next.delete(key);
        else next.set(key, value);
      }
      if (!("page" in patch)) next.delete("page");
      startTransition(() => {
        router.push(`${pathname}?${next.toString()}`);
      });
    },
    [pathname, router, searchParams],
  );

  const view = (searchParams.get("view") ?? "needs-action") as HelpdeskQueueView;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {HELPDESK_QUEUE_VIEWS.map((item) => {
          const active = view === item.value;
          const count = counts[item.value] ?? 0;
          return (
            <button
              key={item.value}
              type="button"
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                active
                  ? "border-teal-600 bg-teal-600 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-teal-300"
              }`}
              onClick={() => push({ view: item.value })}
            >
              {item.label}
              <span className={`ml-1.5 tabular-nums ${active ? "text-teal-100" : "text-slate-400"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <label className="block text-xs font-medium text-slate-600 xl:col-span-2">
          Search
          <div className="mt-1 flex gap-2">
            <input
              className={fieldClass}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") push({ q: q.trim() || null });
              }}
              placeholder="ID, subject, mobile, hospital…"
            />
            <button
              type="button"
              className={secondaryButtonClass}
              disabled={pending}
              onClick={() => push({ q: q.trim() || null })}
            >
              Go
            </button>
          </div>
        </label>
        <label className="block text-xs font-medium text-slate-600">
          Status
          <select
            className={fieldClass}
            value={searchParams.get("status") ?? ""}
            onChange={(e) => push({ status: e.target.value || null })}
          >
            <option value="">Any</option>
            {["OPEN", "IN_PROGRESS", "WAITING_REPLY", "ESCALATED", "RESOLVED", "CLOSED"].map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-600">
          Priority
          <select
            className={fieldClass}
            value={searchParams.get("priority") ?? ""}
            onChange={(e) => push({ priority: e.target.value || null })}
          >
            <option value="">Any</option>
            {HELPDESK_PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
            <option value="URGENT">Urgent</option>
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-600">
          Category
          <select
            className={fieldClass}
            value={searchParams.get("category") ?? ""}
            onChange={(e) => push({ category: e.target.value || null })}
          >
            <option value="">Any</option>
            {HELPDESK_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-600">
          Assignee
          <select
            className={fieldClass}
            value={searchParams.get("assignedToId") ?? ""}
            onChange={(e) => push({ assignedToId: e.target.value || null })}
          >
            <option value="">Any</option>
            <option value="none">Unassigned</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.displayName}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-600">
          Hospital
          <select
            className={fieldClass}
            value={searchParams.get("hospitalId") ?? ""}
            onChange={(e) => push({ hospitalId: e.target.value || null })}
          >
            <option value="">Any</option>
            <option value="none">Platform / none</option>
            {hospitals.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
