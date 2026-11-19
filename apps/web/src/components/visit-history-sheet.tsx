"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { compactButtonClass, compactPrimaryButtonClass, textActionClass } from "@/components/auth-shell";
import { SendPatientMessageButton } from "@/components/send-patient-message-button";
import { withReturnVisit } from "@/lib/appointments/return-visit";
import {
  relativeVisitLabel,
  vitalsDeltaLine,
  vitalsStrip,
  type PastVisitItem,
  type PastVisitVitals,
} from "@/lib/appointments/past-visits";

export type { PastVisitItem, PastVisitVitals };

type Filter = "all" | "doctor" | "labs";

const PastVisitsContext = createContext<((visitId?: string) => void) | null>(null);

export function usePastVisits() {
  return useContext(PastVisitsContext);
}

export function PastVisitsButton({
  label = "Past visits",
  variant = "button",
}: {
  label?: string;
  variant?: "button" | "link";
}) {
  const open = usePastVisits();
  return (
    <button
      type="button"
      className={variant === "link" ? textActionClass : compactButtonClass}
      onClick={() => open?.()}
    >
      {label}
    </button>
  );
}

export function PastVisitsProvider({
  children,
  visits,
  patientHref,
  canPrintSummary,
  canViewLabReports,
  patientPhone,
  returnVisitId = null,
  thisDoctorId,
  todayVitals = null,
}: {
  children: React.ReactNode;
  visits: PastVisitItem[];
  patientHref: string;
  canPrintSummary: boolean;
  canViewLabReports: boolean;
  patientPhone?: string | null;
  returnVisitId?: string | null;
  thisDoctorId: string;
  todayVitals?: PastVisitVitals | null;
}) {
  const [open, setOpen] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [session, setSession] = useState(0);
  const openVisit = useCallback((visitId?: string) => {
    setFocusId(visitId ?? null);
    setSession((current) => current + 1);
    setOpen(true);
  }, []);
  const close = useCallback(() => setOpen(false), []);

  return (
    <PastVisitsContext.Provider value={openVisit}>
      {children}
      <VisitHistoryDrawer
        key={session}
        open={open}
        focusId={focusId}
        onClose={close}
        visits={visits}
        patientHref={patientHref}
        canPrintSummary={canPrintSummary}
        canViewLabReports={canViewLabReports}
        patientPhone={patientPhone}
        returnVisitId={returnVisitId}
        thisDoctorId={thisDoctorId}
        todayVitals={todayVitals}
      />
    </PastVisitsContext.Provider>
  );
}

function VisitHistoryDrawer({
  open,
  focusId,
  onClose,
  visits,
  patientHref,
  canPrintSummary,
  canViewLabReports,
  patientPhone,
  returnVisitId,
  thisDoctorId,
  todayVitals,
}: {
  open: boolean;
  focusId: string | null;
  onClose: () => void;
  visits: PastVisitItem[];
  patientHref: string;
  canPrintSummary: boolean;
  canViewLabReports: boolean;
  patientPhone?: string | null;
  returnVisitId: string | null;
  thisDoctorId: string;
  todayVitals: PastVisitVitals | null;
}) {
  const [mounted, setMounted] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(focusId);
  const focusRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !focusId || !mounted) return;
    focusRef.current?.scrollIntoView({ block: "nearest" });
  }, [open, focusId, filter, mounted]);

  const last = visits[0] ?? null;
  const visible = visits.filter((visit) => {
    if (filter === "doctor" && visit.doctorId !== thisDoctorId) return false;
    if (filter === "labs" && visit.reports.length === 0) return false;
    return true;
  });
  const trend = visits.filter((visit) => vitalsStrip(visit.vitals)).slice(0, 5);
  const sinceLast = vitalsDeltaLine(todayVitals, last?.vitals ?? null, "Since last visit");

  const sheet =
    open && mounted
      ? createPortal(
          <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
            <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close past visits" onClick={onClose} />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="past-visits-title"
              className="relative z-[101] flex max-h-[88dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border border-border bg-white shadow-xl sm:rounded-2xl"
            >
              <div className="shrink-0 border-b border-border bg-white px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 id="past-visits-title" className="font-semibold text-text-primary">
                      Past visits ({visits.length})
                    </h3>
                    <p className="text-xs text-text-secondary">Read a visit here. Open the full record only when you need it.</p>
                  </div>
                  <button type="button" className={compactButtonClass} onClick={onClose}>
                    Close
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
                    All
                  </FilterChip>
                  <FilterChip active={filter === "doctor"} onClick={() => setFilter("doctor")}>
                    This doctor
                  </FilterChip>
                  <FilterChip active={filter === "labs"} onClick={() => setFilter("labs")}>
                    With labs
                  </FilterChip>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto bg-app-bg p-3">
                {trend.length > 0 ? (
                  <div className="mb-3 rounded-xl border border-border bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Recent vitals</p>
                    <ul className="mt-1.5 space-y-1">
                      {trend.map((visit) => (
                        <li key={visit.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-xs">
                          <span className="text-text-secondary">{relativeVisitLabel(visit.at)}</span>
                          <span className="text-right text-text-primary">{vitalsStrip(visit.vitals)}</span>
                        </li>
                      ))}
                    </ul>
                    {sinceLast ? <p className="mt-2 text-xs font-medium text-teal-800">{sinceLast}</p> : null}
                  </div>
                ) : null}
                {visible.length === 0 ? (
                  <p className="px-2 py-6 text-center text-sm text-text-secondary">
                    {visits.length === 0 ? "No earlier visits for this patient." : "No visits match this filter."}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {visible.map((visit) => {
                      const expanded = expandedId === visit.id;
                      const headline = visit.diagnosis.trim() || (visit.handwritten ? "Handwritten note" : "No diagnosis recorded");
                      const readings = vitalsStrip(visit.vitals);
                      return (
                        <li
                          key={visit.id}
                          ref={visit.id === focusId ? focusRef : undefined}
                          className={`rounded-xl border bg-white shadow-sm ${
                            visit.id === last?.id ? "border-amber-300" : "border-border"
                          }`}
                        >
                          <button
                            type="button"
                            className="w-full px-3 py-3 text-left"
                            aria-expanded={expanded}
                            onClick={() => setExpandedId(expanded ? null : visit.id)}
                          >
                            <div className="flex flex-wrap items-center gap-1.5">
                              {visit.id === last?.id ? (
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-950">
                                  Last visit
                                </span>
                              ) : null}
                              <span className="text-sm font-medium text-text-primary">{visit.when}</span>
                              <span className="text-xs text-text-secondary">{relativeVisitLabel(visit.at)}</span>
                            </div>
                            <p className="mt-1 text-sm font-semibold text-text-primary">{headline}</p>
                            {visit.chiefComplaint ? (
                              <p className="mt-0.5 line-clamp-2 text-xs text-text-secondary">{visit.chiefComplaint}</p>
                            ) : null}
                            <p className="mt-1 text-xs text-text-secondary">
                              {visit.doctor} · {visit.department}
                            </p>
                            <p className="mt-1 text-xs text-text-primary">{readings || "Vitals not recorded"}</p>
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {visit.prescription.trim() ? <Chip>Rx</Chip> : null}
                              {visit.reports.length > 0 ? <Chip>Labs</Chip> : null}
                              {visit.summaryAlreadySent ? <Chip>Summary sent</Chip> : null}
                            </div>
                          </button>
                          {expanded ? (
                            <div className="space-y-2 border-t border-border px-3 py-3">
                              {visit.prescription.trim() ? (
                                <Preview label="Prescription" value={visit.prescription} />
                              ) : null}
                              {visit.advice.trim() ? <Preview label="Advice" value={visit.advice} /> : null}
                              {visit.followUpLabel ? <Preview label="Follow-up" value={visit.followUpLabel} /> : null}
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                <Link
                                  href={withReturnVisit(`/appointments/${visit.id}`, returnVisitId)}
                                  className={compactPrimaryButtonClass}
                                  onClick={onClose}
                                >
                                  View full record
                                </Link>
                                {visit.summaryApproved && canPrintSummary ? (
                                  <>
                                    <SendPatientMessageButton
                                      endpoint={`/api/appointments/${visit.id}/summary/send`}
                                      patientPhone={patientPhone}
                                      compact
                                      label="Send on WhatsApp"
                                      alreadySent={Boolean(visit.summaryAlreadySent)}
                                    />
                                    <Link
                                      href={withReturnVisit(`/appointments/${visit.id}/summary`, returnVisitId)}
                                      className={compactButtonClass}
                                    >
                                      Summary
                                    </Link>
                                  </>
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
                                        {report.fileName}
                                      </a>
                                    ))
                                  : null}
                              </div>
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <div className="shrink-0 border-t border-border bg-white px-4 py-3">
                <Link href={patientHref} className={`${compactButtonClass} w-full justify-center`} onClick={onClose}>
                  Full patient file
                </Link>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return sheet;
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
        active ? "bg-teal-700 text-white" : "bg-app-bg text-text-secondary"
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-800">{children}</span>;
}

function Preview({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">{label}</p>
      <p className="mt-0.5 line-clamp-4 whitespace-pre-wrap text-xs text-text-primary">{value}</p>
    </div>
  );
}
