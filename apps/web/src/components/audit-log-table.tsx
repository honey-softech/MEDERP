"use client";

import { useEffect, useMemo, useState } from "react";
import { FilterableTable } from "@/components/filterable-table";
import { fieldClass, primaryButtonClass, secondaryButtonClass } from "@/components/auth-shell";
import { parseAuditChanges, type AuditChange } from "@/lib/audit-changes";

export type AuditLogRow = {
  id: string;
  action: string;
  summary: string;
  actorUsername: string;
  actorRole: string | null;
  createdAt: Date | string;
  metadata?: unknown;
  hospital?: { name: string; code: string } | null;
};

const ROLES = [
  "SUPER_ADMIN",
  "DOCTOR",
  "NURSE",
  "RECEPTIONIST",
  "PHARMACIST",
  "LAB_TECH",
  "ACCOUNTANT",
];

function formatDate(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function dayKey(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayKey() {
  return dayKey(new Date());
}

function humanField(field: string) {
  const labels: Record<string, string> = {
    passwordHash: "Password",
    imageData: "Signature image",
    photoData: "Photo",
    logoData: "Logo",
    sealData: "Seal",
    manufacturerIds: "Medicine brands",
  };
  if (labels[field]) return labels[field];
  return field
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function displayValue(value: string | null) {
  if (value == null || value === "") return "—";
  if (value === "updated") return "Updated";
  return value;
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function AuditRevisionPanel({
  action,
  time,
  summary,
  changes,
  onClose,
}: {
  action: string;
  time: string;
  summary: string;
  changes: AuditChange[];
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="audit-revision-title"
        className="flex h-full w-full max-w-xl flex-col bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h3 id="audit-revision-title" className="text-lg font-semibold text-slate-900">
              Revision
            </h3>
            <p className="mt-1 font-mono text-xs text-slate-500">{action}</p>
            <p className="mt-1 text-sm text-slate-500">{time}</p>
          </div>
          <button type="button" className={secondaryButtonClass} onClick={onClose}>
            Close
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="mb-4 text-sm text-slate-600">{summary}</p>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3 font-medium">Field</th>
                <th className="py-2 pr-3 font-medium">Previous</th>
                <th className="py-2 font-medium">New</th>
              </tr>
            </thead>
            <tbody>
              {changes.map((change) => (
                <tr key={change.field} className="border-b border-slate-100 align-top">
                  <td className="py-2.5 pr-3 font-medium text-slate-800">{humanField(change.field)}</td>
                  <td className="max-w-[10rem] whitespace-pre-wrap break-words py-2.5 pr-3 text-slate-500">
                    {displayValue(change.previous)}
                  </td>
                  <td className="max-w-[10rem] whitespace-pre-wrap break-words py-2.5 text-slate-800">
                    {displayValue(change.next)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </aside>
    </div>
  );
}

export function AuditLogTable({
  logs,
  showHospital = false,
  users = [],
}: {
  logs: AuditLogRow[];
  showHospital?: boolean;
  users?: { username: string; role: string }[];
}) {
  const [date, setDate] = useState(todayKey);
  const [user, setUser] = useState("");
  const [role, setRole] = useState("");
  const [applied, setApplied] = useState({ date: todayKey(), user: "", role: "" });
  const [openId, setOpenId] = useState<string | null>(null);

  const userOptions = useMemo(() => {
    const names = new Set<string>();
    for (const row of users) {
      if (row.role !== "SOFTWARE_ADMIN") names.add(row.username);
    }
    for (const log of logs) {
      if (log.actorRole !== "SOFTWARE_ADMIN") names.add(log.actorUsername);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [logs, users]);

  const filtered = useMemo(() => {
    return logs.filter((log) => {
      if (applied.date && dayKey(log.createdAt) !== applied.date) return false;
      if (applied.user && log.actorUsername !== applied.user) return false;
      if (applied.role && log.actorRole !== applied.role) return false;
      return true;
    });
  }, [applied, logs]);

  const byId = useMemo(() => {
    const map = new Map<string, AuditLogRow>();
    for (const log of filtered) map.set(log.id, log);
    return map;
  }, [filtered]);

  const openLog = openId ? byId.get(openId) : undefined;
  const openChanges = openLog ? parseAuditChanges(openLog.metadata) : [];

  const columns = [
    { key: "time", header: "Time", className: "whitespace-nowrap", filter: false as const },
    ...(showHospital ? [{ key: "hospital", header: "Hospital", filter: false as const }] : []),
    { key: "user", header: "User", className: "font-medium", filter: false as const },
    { key: "role", header: "Role", filter: false as const },
    { key: "action", header: "Action", className: "font-mono text-xs", filter: false as const },
    { key: "details", header: "Details", className: "text-slate-600", filter: false as const },
    {
      key: "view",
      header: "View",
      filter: false as const,
      className: "w-14 text-center",
      render: (row: Record<string, string>) => {
        const log = byId.get(row.id);
        const changes = parseAuditChanges(log?.metadata);
        if (changes.length === 0) {
          return <span className="text-slate-300">—</span>;
        }
        return (
          <button
            type="button"
            aria-label="View revision"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-teal-700 hover:bg-teal-50"
            onClick={() => setOpenId(row.id)}
          >
            <EyeIcon />
          </button>
        );
      },
    },
  ];

  const rows = useMemo(
    () =>
      filtered.map((log) => ({
        id: log.id,
        time: formatDate(log.createdAt),
        hospital: log.hospital ? `${log.hospital.name} (${log.hospital.code})` : "—",
        user: log.actorUsername,
        role: log.actorRole?.replace(/_/g, " ") ?? "—",
        action: log.action,
        details: log.summary,
        view: "",
      })),
    [filtered],
  );

  function search(event: React.FormEvent) {
    event.preventDefault();
    setApplied({ date, user, role });
    setOpenId(null);
  }

  function reset() {
    const today = todayKey();
    setDate(today);
    setUser("");
    setRole("");
    setApplied({ date: today, user: "", role: "" });
    setOpenId(null);
  }

  return (
    <div className="space-y-6">
      <form onSubmit={search} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 md:grid-cols-4">
        <label className="text-sm font-medium text-slate-700">
          Date
          <input className={fieldClass} type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <label className="text-sm font-medium text-slate-700">
          User
          <select className={fieldClass} value={user} onChange={(event) => setUser(event.target.value)}>
            <option value="">All users</option>
            {userOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">
          Role
          <select className={fieldClass} value={role} onChange={(event) => setRole(event.target.value)}>
            <option value="">All roles</option>
            {ROLES.map((item) => (
              <option key={item} value={item}>
                {item.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button className={primaryButtonClass} type="submit">
            Search
          </button>
          <button className={secondaryButtonClass} type="button" onClick={reset}>
            Reset
          </button>
        </div>
      </form>

      <FilterableTable
        columns={columns}
        rows={rows}
        empty="No audit logs match these filters."
        minWidthClass="min-w-[800px]"
        showColumnFilters={false}
      />

      {openLog && openChanges.length > 0 ? (
        <AuditRevisionPanel
          action={openLog.action}
          time={formatDate(openLog.createdAt)}
          summary={openLog.summary}
          changes={openChanges}
          onClose={() => setOpenId(null)}
        />
      ) : null}
    </div>
  );
}
