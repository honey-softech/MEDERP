"use client";

import { useEffect, useState } from "react";
import HospitalUserForm from "@/components/hospital-user-form";
import { primaryButtonClass, secondaryButtonClass } from "@/components/auth-shell";

export function CreateUserDialog({
  departments,
  disabled = false,
  disabledReason,
  subscriptionHref,
}: {
  departments: { id: string; label: string }[];
  disabled?: boolean;
  disabledReason?: string;
  subscriptionHref?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

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
          onClick={() => setOpen(true)}
          disabled={disabled}
          title={disabledReason}
        >
          Create user
        </button>
      </div>
      {disabled && disabledReason ? <p className="mb-6 text-right text-sm text-red-600">{disabledReason}</p> : null}
      {open ? (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50"
          onClick={() => setOpen(false)}
        >
          <div className="flex min-h-full items-start justify-center p-4 sm:p-8">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="create-user-title"
              className="relative my-4 w-full max-w-5xl rounded-2xl border border-slate-200 bg-white p-4 shadow-xl sm:p-6"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 id="create-user-title" className="text-lg font-semibold">
                    Create user
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">Choose a role first. Only the fields for that role are shown.</p>
                </div>
                <button type="button" className={secondaryButtonClass} onClick={() => setOpen(false)}>
                  Close
                </button>
              </div>
              <HospitalUserForm departments={departments} plain />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
