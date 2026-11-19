"use client";

import { useEffect, useId, useState, type ReactNode } from "react";

/** Read-only plan card for the mobile app. Tapping it explains that billing happens on the website. */
export function ManagePlanOnWeb({ host, children }: { host: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm sm:p-6"
      >
        {children}
        <span className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-sm font-medium text-slate-700">
          Manage plan
          <Chevron />
        </span>
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <button
            type="button"
            className="absolute inset-0 cursor-default bg-slate-900/50"
            aria-label="Dismiss"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative z-[1] w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
          >
            <h3 id={titleId} className="text-base font-semibold text-slate-900">
              Manage Plan on the Web
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              You can&apos;t modify this subscription in the app because it is managed on the web at {host}.
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-5 flex h-11 w-full items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-900 hover:bg-slate-300"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Chevron() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5 text-slate-400">
      <path
        d="M7.5 4.5 13 10l-5.5 5.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
