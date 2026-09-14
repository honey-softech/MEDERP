"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HelpdeskBulkBar } from "@/components/helpdesk-bulk-bar";
import { HelpdeskSlaChip } from "@/components/helpdesk-sla-chip";
import { prettyTicketStatus } from "@/lib/helpdesk-options";
import { slaState, type SlaTone } from "@/lib/helpdesk-sla";

export type QueueTicketRow = {
  id: string;
  number: string;
  subject: string;
  status: string;
  priority: string;
  category: string;
  hospital: string;
  from: string;
  assignedTo: string;
  updated: string;
  href: string;
  firstResponseDueAt: string | null;
  resolutionDueAt: string | null;
  firstResponseAt: string | null;
  resolvedAt: string | null;
};

export function HelpdeskQueueTable({
  rows,
  page,
  pageSize,
  total,
  agents,
}: {
  rows: QueueTicketRow[];
  page: number;
  pageSize: number;
  total: number;
  agents: Array<{ id: string; username: string; displayName: string }>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const allSelected = rows.length > 0 && allIds.every((id) => selected.has(id));

  function toggleAll() {
    setSelected((current) => {
      if (allSelected) return new Set();
      return new Set(allIds);
    });
  }

  function toggleOne(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function pageHref(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(nextPage));
    return `?${params.toString()}`;
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-3">
      {selected.size > 0 ? (
        <HelpdeskBulkBar
          ticketIds={[...selected]}
          agents={agents}
          onDone={() => {
            setSelected(new Set());
            router.refresh();
          }}
        />
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[56rem] w-full text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" />
              </th>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">SLA</th>
              <th className="px-3 py-2">Subject</th>
              <th className="px-3 py-2">Hospital</th>
              <th className="px-3 py-2">From</th>
              <th className="px-3 py-2">Assignee</th>
              <th className="px-3 py-2">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-slate-500">
                  No tickets in this view.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const sla = slaState({
                  status: row.status,
                  firstResponseDueAt: row.firstResponseDueAt,
                  resolutionDueAt: row.resolutionDueAt,
                  firstResponseAt: row.firstResponseAt,
                  resolvedAt: row.resolvedAt,
                });
                return (
                  <tr key={row.id} className="hover:bg-slate-50/80">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(row.id)}
                        onChange={() => toggleOne(row.id)}
                        aria-label={`Select ${row.number}`}
                      />
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      <Link href={row.href} className="font-medium text-teal-700 hover:underline">
                        {row.number}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-xs font-medium">{prettyTicketStatus(row.status)}</span>
                      <span className="mt-0.5 block text-[10px] uppercase text-slate-400">{row.priority}</span>
                    </td>
                    <td className="px-3 py-2">
                      <HelpdeskSlaChip label={sla.label} tone={sla.tone as SlaTone} />
                    </td>
                    <td className="px-3 py-2">
                      <Link href={row.href} className="font-medium text-slate-900 hover:underline">
                        {row.subject}
                      </Link>
                      <span className="mt-0.5 block text-[11px] text-slate-400">{row.category}</span>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{row.hospital}</td>
                    <td className="px-3 py-2 text-slate-600">{row.from}</td>
                    <td className="px-3 py-2 text-slate-600">{row.assignedTo}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{row.updated}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-500">
        <p>
          {total === 0
            ? "0 tickets"
            : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`}
        </p>
        <div className="flex gap-2">
          {page <= 1 ? (
            <span className="rounded-lg border border-slate-100 px-3 py-1 text-slate-300">Previous</span>
          ) : (
            <Link
              href={pageHref(page - 1)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1 font-medium text-slate-700 hover:border-teal-300"
            >
              Previous
            </Link>
          )}
          <span className="px-2 py-1 tabular-nums">
            {page} / {totalPages}
          </span>
          {page >= totalPages ? (
            <span className="rounded-lg border border-slate-100 px-3 py-1 text-slate-300">Next</span>
          ) : (
            <Link
              href={pageHref(page + 1)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1 font-medium text-slate-700 hover:border-teal-300"
            >
              Next
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
