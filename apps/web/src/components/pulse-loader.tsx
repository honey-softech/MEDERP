const DOT_SIZE = {
  sm: "h-1.5 w-1.5",
  md: "h-2.5 w-2.5",
  lg: "h-3.5 w-3.5",
} as const;

export type PulseSize = keyof typeof DOT_SIZE;

/** Three pulsing dots — the single loading signal used across MedERP. */
export function PulseLoader({
  label,
  size = "md",
  className = "",
}: {
  label?: string;
  size?: PulseSize;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`} role="status" aria-live="polite">
      <span className="inline-flex items-center gap-1" aria-hidden>
        <span className={`pulse-dot rounded-full bg-primary ${DOT_SIZE[size]}`} />
        <span className={`pulse-dot rounded-full bg-primary ${DOT_SIZE[size]}`} />
        <span className={`pulse-dot rounded-full bg-primary ${DOT_SIZE[size]}`} />
      </span>
      {label ? <span className="text-sm text-text-secondary">{label}</span> : null}
      <span className="sr-only">{label ?? "Loading"}</span>
    </span>
  );
}

/** Full-page fallback shown while a route renders. */
export function PulseScreen({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-app-bg px-6">
      <PulseLoader size="lg" />
      <div className="w-full max-w-sm space-y-2.5" aria-hidden>
        <div className="pulse-block h-3 w-2/5 rounded-full" />
        <div className="pulse-block h-3 w-full rounded-full" />
        <div className="pulse-block h-3 w-4/5 rounded-full" />
      </div>
      <p className="text-sm text-text-secondary">{label}…</p>
    </div>
  );
}

/** In-page fallback for a panel or card that is still fetching. */
export function PulseBlock({ label = "Loading", className = "" }: { label?: string; className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-10 ${className}`}>
      <PulseLoader />
      <p className="text-sm text-text-secondary">{label}…</p>
    </div>
  );
}
