"use client";

import Link from "next/link";

export function ConsultQueueNav({
  previousId,
  nextId,
}: {
  previousId: string | null;
  nextId: string | null;
}) {
  if (!previousId && !nextId) return null;

  return (
    <div className="flex items-center gap-1">
      {previousId ? (
        <Link
          href={`/appointments/${previousId}`}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-text-secondary hover:bg-app-bg hover:text-text-primary"
          title="Previous patient in queue"
          aria-label="Previous patient in queue"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
      ) : (
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-text-disabled" aria-hidden>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </span>
      )}
      {nextId ? (
        <Link
          href={`/appointments/${nextId}`}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-text-secondary hover:bg-app-bg hover:text-text-primary"
          title="Next patient in queue"
          aria-label="Next patient in queue"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M9 18l6-6-6-6" />
          </svg>
        </Link>
      ) : (
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-text-disabled" aria-hidden>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </span>
      )}
    </div>
  );
}
