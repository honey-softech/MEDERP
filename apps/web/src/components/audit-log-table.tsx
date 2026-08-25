"use client";

import { useMemo, useState } from "react";
import { FilterableTable } from "@/components/filterable-table";
import { fieldClass, primaryButtonClass, secondaryButtonClass } from "@/components/auth-shell";

export type AuditLogRow = {
  id: string;
  action: string;
  summary: string;
  actorUsername: string;
  actorRole: string | null;
  createdAt: Date | string;
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

export function AuditLogTable({
  logs,
  showHospital = false,
  users = [],
}: {
  logs: AuditLogRow[];
  showHospital?: boolean;
  users?: { username: string; role: string }[];
}) {
  const [date, setDate] = useState("");
  const [user, setUser] = useState("");
  const [role, setRole] = useState("");
  const [searched, setSearched] = useState(false);
  const [applied, setApplied] = useState({ date: "", user: "", role: "" });

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

  const columns = [
    { key: "time", header: "Time", className: "whitespace-nowrap", filter: false as const },
    ...(showHospital ? [{ key: "hospital", header: "Hospital", filter: false as const }] : []),
    { key: "user", header: "User", className: "font-medium", filter: false as const },
    { key: "role", header: "Role", filter: false as const },
    { key: "action", header: "Action", className: "font-mono text-xs", filter: false as const },
    { key: "details", header: "Details", className: "text-slate-600", filter: false as const },
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
      })),
    [filtered],
  );

  function search(event: React.FormEvent) {
    event.preventDefault();
    setApplied({ date, user, role });
    setSearched(true);
  }

  function reset() {
    setDate("");
    setUser("");
    setRole("");
    setApplied({ date: "", user: "", role: "" });
    setSearched(false);
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

      {searched ? (
        <FilterableTable
          columns={columns}
          rows={rows}
          empty="No audit logs match these filters."
          minWidthClass="min-w-[800px]"
          showColumnFilters={false}
        />
      ) : (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-500">
          Choose date, user, and/or role, then click Search to load the audit log.
        </p>
      )}
    </div>
  );
}
