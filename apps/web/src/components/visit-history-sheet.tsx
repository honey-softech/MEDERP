"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { compactButtonClass, compactPrimaryButtonClass, textActionClass } from "@/components/auth-shell";

export type PastVisitItem = {
  id: string;
  when: string;
  doctor: string;
  department: string;
  diagnosis: string;
  chiefComplaint: string;
  summaryApproved: boolean;
  reports: { id: string; fileName: string }[];
};

export function VisitHistorySheet({
  visits,
  patientHref,
  canPrintSummary,
  canViewLabReports,
  label = "Past visits",
  variant = "button",
}: {
  visits: PastVisitItem[];
  patientHref: string;
  canPrintSummary: boolean;
  canViewLabReports: boolean;
  label?: string;
  variant?: "button" | "link";
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const sheet =
    open && mounted
      ? createPortal(
          <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
            <button
              type="button"
              className="absolute inset-0 bg-black/50"
              aria-label="Close past visits"
              onClick={() => setOpen(false)}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="past-visits-title"
              className="relative z-[101] flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-border bg-white shadow-xl sm:rounded-2xl"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-border bg-white px-4 py-3">
                <div>
                  <h3 id="past-visits-title" className="font-semibold text-text-primary">
                    Past visits
                  </h3>
                  <p className="text-xs text-text-secondary">
                    {visits.length} previous record{visits.length === 1 ? "" : "s"}
                  </p>
                </div>
                <button type="button" className={compactButtonClass} onClick={() => setOpen(false)}>
                  Close
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto bg-app-bg p-3">
                {visits.length === 0 ? (
                  <p className="px-2 py-6 text-center text-sm text-text-secondary">
                    No earlier visits for this patient.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {visits.map((visit) => (
                      <li key={visit.id} className="rounded-xl border border-border bg-white p-3 shadow-sm">
                        <p className="text-sm font-medium text-text-primary">{visit.when}</p>
                        <p className="text-xs text-text-secondary">
                          {visit.doctor} · {visit.department}
                        </p>
                        {visit.chiefComplaint ? (
                          <p className="mt-1 text-xs text-text-secondary">Complaint · {visit.chiefComplaint}</p>
                        ) : null}
                        {visit.diagnosis ? (
                          <p className="mt-0.5 text-xs text-text-primary">Dx · {visit.diagnosis}</p>
                        ) : null}
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Link
                            href={`/appointments/${visit.id}`}
                            className={compactButtonClass}
                            onClick={() => setOpen(false)}
                          >
                            Open visit
                          </Link>
                          {visit.summaryApproved && canPrintSummary ? (
                            <Link href={`/appointments/${visit.id}/summary`} className={compactPrimaryButtonClass}>
                              Summary
                            </Link>
                          ) : null}
                          {canViewLabReports
                            ? visit.reports.map((report) => (
                                <a
                                  key={report.id}
                                  href={`/api/lab/orders/${report.id}/report`}
                                  className={compactButtonClass}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  File
                                </a>
                              ))
                            : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="shrink-0 border-t border-border bg-white px-4 py-3">
                <Link
                  href={patientHref}
                  className={`${compactButtonClass} w-full justify-center`}
                  onClick={() => setOpen(false)}
                >
                  Full patient file
                </Link>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        type="button"
        className={variant === "link" ? textActionClass : compactButtonClass}
        onClick={() => setOpen(true)}
      >
        {label}
      </button>
      {sheet}
    </>
  );
}
