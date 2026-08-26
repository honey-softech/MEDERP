"use client";

import Link from "next/link";
import { useState } from "react";
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

  return (
    <>
      <button
        type="button"
        className={variant === "link" ? textActionClass : compactButtonClass}
        onClick={() => setOpen(true)}
      >
        {label}
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <button
            type="button"
            className="absolute inset-0 bg-text-primary/40"
            aria-label="Close past visits"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-10 flex max-h-[85dvh] w-full max-w-lg flex-col rounded-t-2xl border border-border bg-surface shadow-card sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <h3 className="font-semibold text-text-primary">Past visits</h3>
                <p className="text-xs text-text-secondary">{visits.length} previous record{visits.length === 1 ? "" : "s"}</p>
              </div>
              <button
                type="button"
                className={compactButtonClass}
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="overflow-y-auto p-3">
              {visits.length === 0 ? (
                <p className="px-2 py-6 text-center text-sm text-text-secondary">No earlier visits for this patient.</p>
              ) : (
                <ul className="space-y-2">
                  {visits.map((visit) => (
                    <li key={visit.id} className="rounded-xl border border-border p-3">
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
                        <Link href={`/appointments/${visit.id}`} className={compactButtonClass} onClick={() => setOpen(false)}>
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
            <div className="border-t border-border px-4 py-3">
              <Link href={patientHref} className={`${compactButtonClass} w-full`} onClick={() => setOpen(false)}>
                Full patient file
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
