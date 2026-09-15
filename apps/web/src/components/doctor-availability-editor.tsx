"use client";

import { useEffect, useState } from "react";
import { buttonClass, fieldClass, secondaryButtonClass } from "@/components/auth-shell";

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

/** Special UI values — expanded to real dayOfWeek 0–6 on save. */
const EVERYDAY = -3;
const WEEKEND = -2;
const WEEKDAYS = -1;

const EVERYDAY_DAYS = [0, 1, 2, 3, 4, 5, 6] as const;
const WEEKDAY_DAYS = [1, 2, 3, 4, 5] as const;
const WEEKEND_DAYS = [0, 6] as const;

const PRESETS = [
  { value: EVERYDAY, label: "Everyday (Sun–Sat)", days: EVERYDAY_DAYS, sortKey: -0.3 },
  { value: WEEKDAYS, label: "Weekdays (Mon–Fri)", days: WEEKDAY_DAYS, sortKey: -0.2 },
  { value: WEEKEND, label: "Weekend (Sat–Sun)", days: WEEKEND_DAYS, sortKey: -0.1 },
] as const;

type WindowRow = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

const emptyRow = (): WindowRow => ({
  dayOfWeek: WEEKDAYS,
  startTime: "10:00",
  endTime: "12:00",
});

function expandForSave(rows: WindowRow[]): WindowRow[] {
  const out: WindowRow[] = [];
  for (const row of rows) {
    const preset = PRESETS.find((p) => p.value === row.dayOfWeek);
    if (preset) {
      for (const day of preset.days) {
        out.push({ dayOfWeek: day, startTime: row.startTime, endTime: row.endTime });
      }
    } else {
      out.push(row);
    }
  }
  return out;
}

function tryCollapsePreset(
  remaining: WindowRow[],
  days: readonly number[],
  presetValue: number,
  startTime: string,
  endTime: string,
): WindowRow | null {
  const matches = days.every((day) =>
    remaining.some((r) => r.dayOfWeek === day && r.startTime === startTime && r.endTime === endTime),
  );
  if (!matches) return null;
  for (const day of days) {
    const idx = remaining.findIndex(
      (r) => r.dayOfWeek === day && r.startTime === startTime && r.endTime === endTime,
    );
    if (idx >= 0) remaining.splice(idx, 1);
  }
  return { dayOfWeek: presetValue, startTime, endTime };
}

/** Collapse identical Everyday / Weekdays / Weekend bands for easier editing. */
function collapseForEdit(rows: WindowRow[]): WindowRow[] {
  const remaining = [...rows];
  const collapsed: WindowRow[] = [];

  const timeKeys = new Map<string, { startTime: string; endTime: string }>();
  for (const row of rows) {
    timeKeys.set(`${row.startTime}|${row.endTime}`, { startTime: row.startTime, endTime: row.endTime });
  }

  // Largest groups first so Everyday wins over Weekdays+Weekend.
  for (const { startTime, endTime } of timeKeys.values()) {
    const everyday = tryCollapsePreset(remaining, EVERYDAY_DAYS, EVERYDAY, startTime, endTime);
    if (everyday) collapsed.push(everyday);
  }
  for (const { startTime, endTime } of timeKeys.values()) {
    const weekdays = tryCollapsePreset(remaining, WEEKDAY_DAYS, WEEKDAYS, startTime, endTime);
    if (weekdays) collapsed.push(weekdays);
  }
  for (const { startTime, endTime } of timeKeys.values()) {
    const weekend = tryCollapsePreset(remaining, WEEKEND_DAYS, WEEKEND, startTime, endTime);
    if (weekend) collapsed.push(weekend);
  }

  return [...collapsed, ...remaining].sort((a, b) => {
    const sortKey = (day: number) => PRESETS.find((p) => p.value === day)?.sortKey ?? day;
    const dayA = sortKey(a.dayOfWeek);
    const dayB = sortKey(b.dayOfWeek);
    if (dayA !== dayB) return dayA - dayB;
    return a.startTime.localeCompare(b.startTime);
  });
}

export function DoctorAvailabilityEditor({
  doctorId,
  doctorLabel,
}: {
  doctorId: string;
  doctorLabel: string;
}) {
  const [windows, setWindows] = useState<WindowRow[]>([]);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    void fetch(`/api/hospital/staff/${doctorId}/availability`)
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || `Could not load availability (${response.status}).`);
        }
        const rows = Array.isArray(data.windows)
          ? data.windows.map((w: { dayOfWeek: number; startTime: string; endTime: string }) => ({
              dayOfWeek: w.dayOfWeek,
              startTime: w.startTime,
              endTime: w.endTime,
            }))
          : [];
        setWindows(collapseForEdit(rows));
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Could not load availability.");
        setWindows([]);
      })
      .finally(() => setLoading(false));
  }, [doctorId]);

  async function onSave(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    setMessage("");
    const payloadWindows = expandForSave(windows);
    const response = await fetch(`/api/hospital/staff/${doctorId}/availability`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ windows: payloadWindows }),
    });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not save availability.");
      return;
    }
    setMessage("Availability saved. Booking will use these windows.");
    if (Array.isArray(data.windows)) {
      setWindows(
        collapseForEdit(
          data.windows.map((w: { dayOfWeek: number; startTime: string; endTime: string }) => ({
            dayOfWeek: w.dayOfWeek,
            startTime: w.startTime,
            endTime: w.endTime,
          })),
        ),
      );
    }
  }

  return (
    <form onSubmit={onSave} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="font-semibold text-slate-900">{doctorLabel}</h4>
          <p className="mt-1 text-xs text-slate-500">
            Use <strong>Everyday</strong>, <strong>Weekdays</strong>, or <strong>Weekend</strong> for the same
            hours across those days. Add more windows for afternoon/evening, or pick a single day when needed.
            Leave empty to allow any time (legacy).
          </p>
        </div>
        <button
          type="button"
          className={secondaryButtonClass}
          onClick={() => setWindows((current) => [...current, emptyRow()])}
        >
          Add window
        </button>
      </div>

      {loading ? <p className="mt-3 text-sm text-slate-500">Loading…</p> : null}

      <div className="mt-3 space-y-2">
        {windows.length === 0 && !loading ? (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">No windows — free-form booking.</p>
        ) : null}
        {windows.map((row, index) => (
          <div key={`${row.dayOfWeek}-${row.startTime}-${index}`} className="grid gap-2 sm:grid-cols-[1fr_7rem_7rem_auto]">
            <select
              className={fieldClass}
              value={row.dayOfWeek}
              onChange={(event) => {
                const dayOfWeek = Number(event.target.value);
                setWindows((current) =>
                  current.map((item, i) => (i === index ? { ...item, dayOfWeek } : item)),
                );
              }}
            >
              {PRESETS.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {preset.label}
                </option>
              ))}
              {DAY_LABELS.map((label, day) => (
                <option key={label} value={day}>
                  {label}
                </option>
              ))}
            </select>
            <input
              className={fieldClass}
              type="time"
              value={row.startTime}
              onChange={(event) => {
                const startTime = event.target.value;
                setWindows((current) =>
                  current.map((item, i) => (i === index ? { ...item, startTime } : item)),
                );
              }}
              required
            />
            <input
              className={fieldClass}
              type="time"
              value={row.endTime}
              onChange={(event) => {
                const endTime = event.target.value;
                setWindows((current) =>
                  current.map((item, i) => (i === index ? { ...item, endTime } : item)),
                );
              }}
              required
            />
            <button
              type="button"
              className="text-sm font-medium text-red-600 hover:underline"
              onClick={() => setWindows((current) => current.filter((_, i) => i !== index))}
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {message ? <p className="mt-3 text-sm text-teal-700">{message}</p> : null}
      <button className={`${buttonClass} mt-4`} type="submit" disabled={pending || loading}>
        {pending ? "Saving…" : "Save availability"}
      </button>
    </form>
  );
}
