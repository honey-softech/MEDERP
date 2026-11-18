export function SettingRow({
  label,
  hint,
  detail,
  children,
}: {
  label: string;
  hint?: string;
  detail?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-3 border-b border-border py-4 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-8">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium text-text-primary">{label}</p>
          {detail ? <InfoTip text={detail} /> : null}
        </div>
        {hint ? <p className="mt-0.5 max-w-md text-sm text-text-secondary">{hint}</p> : null}
      </div>
      <div className="sm:pt-0.5">{children}</div>
    </div>
  );
}

function InfoTip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border text-[10px] leading-none font-semibold text-text-secondary"
        aria-label={text}
      >
        i
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute top-6 left-0 z-20 hidden w-64 rounded-lg border border-border bg-surface p-2 text-left text-xs font-normal text-text-secondary shadow-card group-focus-within:block group-hover:block"
      >
        {text}
      </span>
    </span>
  );
}
