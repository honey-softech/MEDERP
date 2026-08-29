"use client";

/** Compact chevron expand/collapse control used across dense admin lists. */
export function ExpandToggle({
  open,
  onToggle,
  labelOpen = "Collapse",
  labelClosed = "Expand",
  count,
  iconOnly = false,
  className = "",
}: {
  open: boolean;
  onToggle: () => void;
  labelOpen?: string;
  labelClosed?: string;
  count?: number;
  /** Arrow only — use in narrow rails where the Expand/Collapse label would overflow. */
  iconOnly?: boolean;
  className?: string;
}) {
  const label = open ? labelOpen : labelClosed;
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-label={count != null ? `${label} (${count})` : label}
      title={label}
      onClick={onToggle}
      className={
        iconOnly
          ? `inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border text-text-secondary hover:bg-app-bg hover:text-text-primary ${className}`
          : `inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium text-text-secondary hover:bg-app-bg hover:text-text-primary ${className}`
      }
    >
      <svg
        viewBox="0 0 24 24"
        className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
      {!iconOnly ? (
        <>
          <span>{label}</span>
          {count != null ? <span className="tabular-nums text-text-disabled">({count})</span> : null}
        </>
      ) : null}
    </button>
  );
}
