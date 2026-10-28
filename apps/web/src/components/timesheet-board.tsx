"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { inr } from "@/lib/display";
import { primaryButtonClass, secondaryButtonClass } from "@/lib/ui";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const KINDS = [
  { value: "WORKED", label: "Worked" },
  { value: "HALF_DAY", label: "Half day" },
  { value: "CASUAL_LEAVE", label: "Casual leave" },
  { value: "SICK_LEAVE", label: "Sick leave" },
  { value: "ABSENT", label: "Absent" },
] as const;

type Day = {
  date: string;
  weekday: number;
  weeklyOff: boolean;
  holidayName: string | null;
  kind: string | null;
  clockIn: string | null;
  clockOut: string | null;
  note: string | null;
  weekStart: string;
  weekStatus: string | null;
  reviewNote: string | null;
  locked: boolean;
  fromLeave: boolean;
};

type Week = {
  weekStart: string;
  weekEnd: string;
  status: string | null;
  reviewNote: string | null;
  canSubmit: boolean;
};

type Salary = {
  dailyRate: number;
  paidDays: number;
  unpaidDays: number;
  pendingDays: number;
  casualUsed: number;
  sickUsed: number;
  casualUsedYear: number;
  sickUsedYear: number;
  amount: number;
} | null;

function statusLabel(status: string | null) {
  if (status === "SUBMITTED") return "Waiting for approval";
  if (status === "APPROVED") return "Approved";
  if (status === "RETURNED") return "Sent back";
  return "Not submitted";
}

export function TimesheetBoard({
  month,
  prevMonth,
  nextMonth,
  days,
  weeks,
  salary,
  casualLeaveDays,
  sickLeaveDays,
  hasPay,
}: {
  month: string;
  prevMonth: string;
  nextMonth: string;
  days: Day[];
  weeks: Week[];
  salary: Salary;
  casualLeaveDays: number;
  sickLeaveDays: number;
  hasPay: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");

  async function post(body: Record<string, unknown>, key: string) {
    setError("");
    setPending(key);
    const response = await fetch("/api/timesheet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    setPending("");
    if (!response.ok) {
      setError(payload?.error || "Could not save the timesheet.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <a className={secondaryButtonClass} href={`/timesheet?month=${prevMonth}`}>
            Previous
          </a>
          <a className={secondaryButtonClass} href={`/timesheet?month=${nextMonth}`}>
            Next
          </a>
        </div>
        <p className="text-sm font-medium text-text-primary">{month}</p>
      </div>

      <section className="rounded-xl border border-border bg-surface p-4">
        {hasPay && salary ? (
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Salary" value={inr(salary.amount)} />
            <Stat label="Paid days" value={String(salary.paidDays)} />
            <Stat label="Unpaid days" value={String(salary.unpaidDays)} />
            <Stat label="Not yet included" value={String(salary.pendingDays)} />
          </div>
        ) : (
          <p className="text-sm text-text-secondary">The hospital admin has not set your pay yet. Your days are still saved.</p>
        )}
        {hasPay ? (
          <p className="mt-3 text-xs text-text-secondary">
            Daily rate {salary ? inr(salary.dailyRate) : "—"}. Casual leave {salary?.casualUsedYear ?? 0} of {casualLeaveDays} paid days this year. Sick leave {salary?.sickUsedYear ?? 0} of {sickLeaveDays}. Only approved weeks are included.
          </p>
        ) : null}
      </section>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {weeks.map((week) => (
        <section key={week.weekStart} className="rounded-xl border border-border bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
            <div>
              <p className="text-sm font-medium text-text-primary">
                {formatDay(week.weekStart)} – {formatDay(week.weekEnd)}
              </p>
              <p className="text-xs text-text-secondary">
                {statusLabel(week.status)}
                {week.reviewNote ? ` · ${week.reviewNote}` : ""}
              </p>
            </div>
            {week.canSubmit ? (
              <button
                type="button"
                className={primaryButtonClass}
                disabled={pending === week.weekStart}
                onClick={() => post({ action: "submit", weekStart: week.weekStart }, week.weekStart)}
              >
                Submit week
              </button>
            ) : null}
          </div>
          <div className="divide-y divide-border">
            {days
              .filter((day) => day.weekStart === week.weekStart)
              .map((day) => (
                <DayRow key={day.date} day={day} pending={pending === day.date} onSave={(body) => post(body, day.date)} />
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-text-secondary">{label}</p>
      <p className="text-lg font-semibold text-text-primary">{value}</p>
    </div>
  );
}

function DayRow({
  day,
  pending,
  onSave,
}: {
  day: Day;
  pending: boolean;
  onSave: (body: Record<string, unknown>) => void;
}) {
  const label = day.holidayName ? day.holidayName : day.weeklyOff ? "Weekly off" : null;
  if (label) {
    return (
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <p className="text-sm text-text-primary">
          {WEEKDAYS[day.weekday]} {formatDay(day.date)}
        </p>
        <p className="text-sm text-text-secondary">{label}</p>
      </div>
    );
  }
  if (day.locked) {
    const kind = KINDS.find((item) => item.value === day.kind)?.label ?? "No entry";
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <p className="text-sm text-text-primary">
          {WEEKDAYS[day.weekday]} {formatDay(day.date)}
        </p>
        <p className="text-sm text-text-secondary">
          {kind}
          {day.clockIn && day.clockOut ? ` · ${day.clockIn}–${day.clockOut}` : ""}
        </p>
      </div>
    );
  }
  return (
    <form
      className="grid gap-2 px-4 py-3 sm:grid-cols-[8rem_9rem_6rem_6rem_auto] sm:items-center"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        onSave({
          action: "day",
          date: day.date,
          kind: String(data.get("kind")),
          clockIn: String(data.get("clockIn") || ""),
          clockOut: String(data.get("clockOut") || ""),
          note: String(data.get("note") || ""),
        });
      }}
    >
      <p className="text-sm text-text-primary">
        {WEEKDAYS[day.weekday]} {formatDay(day.date)}
        {day.fromLeave ? <span className="mt-0.5 block text-xs text-text-secondary">From approved leave</span> : null}
      </p>
      <select name="kind" defaultValue={day.kind ?? "WORKED"} className="h-9 rounded-lg border border-border px-2 text-sm">
        {KINDS.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      <input name="clockIn" type="time" defaultValue={day.clockIn ?? ""} className="h-9 rounded-lg border border-border px-2 text-sm" />
      <input name="clockOut" type="time" defaultValue={day.clockOut ?? ""} className="h-9 rounded-lg border border-border px-2 text-sm" />
      <button type="submit" className={secondaryButtonClass} disabled={pending}>
        Save
      </button>
    </form>
  );
}

function formatDay(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day))) + (key.endsWith("-01") ? ` ${year}` : "");
}
