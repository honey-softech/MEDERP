import type { SlaTone } from "@/lib/helpdesk-sla";

const TONE_CLASS: Record<SlaTone, string> = {
  ok: "border-slate-200 bg-slate-50 text-slate-700",
  soon: "border-amber-200 bg-amber-50 text-amber-900",
  breached: "border-red-200 bg-red-50 text-red-900",
  met: "border-emerald-200 bg-emerald-50 text-emerald-900",
};

export function HelpdeskSlaChip({ label, tone }: { label: string; tone: SlaTone }) {
  return (
    <span
      className={`inline-flex max-w-full truncate rounded-full border px-2 py-0.5 text-[11px] font-medium ${TONE_CLASS[tone]}`}
      title={label}
    >
      {label}
    </span>
  );
}
