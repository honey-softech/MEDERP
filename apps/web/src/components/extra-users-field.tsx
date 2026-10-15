"use client";

import { compactButtonClass } from "@/components/auth-shell";
import { EXTRA_USER_MONTHLY_FEE, MAX_EXTRA_USERS } from "@/lib/subscription-tiers";

export function ExtraUsersField({
  value,
  onChange,
  includedSeats,
  min = 0,
  disabled = false,
  note,
}: {
  value: number;
  onChange: (value: number) => void;
  includedSeats: number | null;
  min?: number;
  disabled?: boolean;
  note?: string;
}) {
  if (includedSeats == null) {
    return (
      <p className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
        This plan includes unlimited users.
      </p>
    );
  }

  const total = includedSeats + value;
  const atMin = value <= min;
  const atMax = value >= MAX_EXTRA_USERS;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-800">Add extra users</p>
          <p className="mt-0.5 text-xs text-slate-500">
            ₹{EXTRA_USER_MONTHLY_FEE}/month each, before GST. Plan includes {includedSeats}. Total seats: {total}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`${compactButtonClass} w-10 px-0`}
            disabled={disabled || atMin}
            aria-label="Remove extra user"
            onClick={() => onChange(value - 1)}
          >
            −
          </button>
          <span className="w-8 text-center text-sm font-semibold tabular-nums" aria-live="polite">
            {value}
          </span>
          <button
            type="button"
            className={compactButtonClass}
            disabled={disabled || atMax}
            onClick={() => onChange(value + 1)}
          >
            Add user
          </button>
        </div>
      </div>
      {note ? <p className="mt-2 text-xs text-slate-500">{note}</p> : null}
    </div>
  );
}
