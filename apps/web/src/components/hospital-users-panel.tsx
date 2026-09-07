"use client";

import { useEffect, useState } from "react";
import { FilterableTable } from "@/components/filterable-table";
import HospitalUserForm, { type HospitalUserFormInitial } from "@/components/hospital-user-form";
import { primaryButtonClass, secondaryButtonClass } from "@/components/auth-shell";

type UserRow = {
  id: string;
  code: string;
  employeeId: string;
  username: string;
  mobile: string;
  role: string;
  verified: string;
};

export function HospitalUsersPanel({
  users,
  departments,
  disabled = false,
  disabledReason,
  subscriptionHref,
}: {
  users: UserRow[];
  departments: { id: string; label: string }[];
  disabled?: boolean;
  disabledReason?: string;
  subscriptionHref?: string;
}) {
  const [dialog, setDialog] = useState<"create" | { id: string } | null>(null);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-end gap-2">
        {disabled && subscriptionHref ? (
          <a href={subscriptionHref} className={secondaryButtonClass}>
            Add user to subscription
          </a>
        ) : null}
        <button
          type="button"
          className={primaryButtonClass}
          onClick={() => setDialog("create")}
          disabled={disabled}
          title={disabledReason}
        >
          Create user
        </button>
      </div>
      {disabled && disabledReason ? <p className="mb-6 text-right text-sm text-red-600">{disabledReason}</p> : null}
      {dialog ? (
        <UserFormDialog
          mode={dialog}
          departments={departments}
          onClose={() => setDialog(null)}
        />
      ) : null}
      <div className="mt-8">
        <FilterableTable
          rows={users.map((row) => ({
            ...row,
            edit: "Edit",
          }))}
          columns={[
            { key: "code", header: "User ID", className: "font-mono text-xs" },
            { key: "employeeId", header: "Employee ID" },
            { key: "username", header: "Name", className: "font-medium" },
            { key: "mobile", header: "Mobile" },
            { key: "role", header: "Role" },
            { key: "verified", header: "Status" },
            {
              key: "edit",
              header: "Action",
              filter: false,
              render: (row) => (
                <button
                  type="button"
                  className="font-medium text-primary hover:underline"
                  onClick={() => setDialog({ id: row.id })}
                >
                  Edit
                </button>
              ),
            },
          ]}
        />
      </div>
    </>
  );
}

function UserFormDialog({
  mode,
  departments,
  onClose,
}: {
  mode: "create" | { id: string };
  departments: { id: string; label: string }[];
  onClose: () => void;
}) {
  const editingId = mode === "create" ? null : mode.id;
  const [initial, setInitial] = useState<HospitalUserFormInitial | null>(editingId ? null : { role: "RECEPTIONIST" });
  const [error, setError] = useState("");

  useEffect(() => {
    if (!editingId) return;
    let cancelled = false;
    setInitial(null);
    setError("");
    void fetch(`/api/hospital/users/${editingId}`)
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as { user?: HospitalUserFormInitial; error?: string };
        if (cancelled) return;
        if (!response.ok || !data.user) {
          setError(data.error ?? "Could not load this user.");
          return;
        }
        setInitial(data.user);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load this user.");
      });
    return () => {
      cancelled = true;
    };
  }, [editingId]);

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

  const title = editingId ? "Edit user" : "Create user";

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50" onClick={onClose}>
      <div className="flex min-h-full items-start justify-center p-4 sm:p-8">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="hospital-user-dialog-title"
          className="relative my-4 w-full max-w-5xl rounded-2xl border border-slate-200 bg-white p-4 shadow-xl sm:p-6"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 id="hospital-user-dialog-title" className="text-lg font-semibold">
                {title}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {editingId
                  ? "Saved details are loaded below. Update any field and save."
                  : "Name, mobile, and password are required. Expand a section for extra details."}
              </p>
            </div>
            <button type="button" className={secondaryButtonClass} onClick={onClose}>
              Close
            </button>
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {!initial && !error ? <p className="text-sm text-slate-500">Loading user…</p> : null}
          {initial ? (
            <HospitalUserForm
              key={initial.id ?? "create"}
              initial={initial}
              departments={departments}
              plain
              returnHref={null}
              onSaved={onClose}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
