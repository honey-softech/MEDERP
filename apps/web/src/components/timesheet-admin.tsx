"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { inr } from "@/lib/display";
import { fieldClass, primaryButtonClass, secondaryButtonClass } from "@/lib/ui";

const WEEKDAYS = [
  { value: "0", label: "Sun" },
  { value: "1", label: "Mon" },
  { value: "2", label: "Tue" },
  { value: "3", label: "Wed" },
  { value: "4", label: "Thu" },
  { value: "5", label: "Fri" },
  { value: "6", label: "Sat" },
];

type StaffRow = {
  id: string;
  name: string;
  role: string;
  payBasis: "MONTHLY" | "DAILY";
  monthlyAmount: string;
  dailyRate: string;
  monthDivisor: "FIXED_30" | "CALENDAR_DAYS";
  casualLeaveDays: number;
  sickLeaveDays: number;
  salary: {
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
};

export function TimesheetAdmin({
  month,
  prevMonth,
  nextMonth,
  weeklyOffDays,
  holidays,
  pending,
  staff,
}: {
  month: string;
  prevMonth: string;
  nextMonth: string;
  weeklyOffDays: string[];
  holidays: { id: string; date: string; name: string }[];
  pending: { staffId: string; name: string; weekStart: string }[];
  staff: StaffRow[];
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  async function post(body: Record<string, unknown>, key: string) {
    setError("");
    setBusy(key);
    const response = await fetch("/api/hospital/timesheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    setBusy("");
    if (!response.ok) {
      setError(payload?.error || "Could not save.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <a className={secondaryButtonClass} href={`/hospital/timesheets?month=${prevMonth}`}>
            Previous
          </a>
          <a className={secondaryButtonClass} href={`/hospital/timesheets?month=${nextMonth}`}>
            Next
          </a>
        </div>
        <p className="text-sm font-medium">{month}</p>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-text-primary">Waiting for approval</h2>
        {pending.length === 0 ? (
          <p className="mt-2 text-sm text-text-secondary">No submitted weeks right now.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {pending.map((row) => (
              <li key={`${row.staffId}-${row.weekStart}`} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <p className="text-sm text-text-primary">
                  {row.name} · week of {row.weekStart}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={primaryButtonClass}
                    disabled={busy === `${row.staffId}-approve`}
                    onClick={() =>
                      post({ action: "review", staffId: row.staffId, weekStart: row.weekStart, decision: "approve" }, `${row.staffId}-approve`)
                    }
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className={secondaryButtonClass}
                    disabled={busy === `${row.staffId}-return`}
                    onClick={() => {
                      const note = window.prompt("Note for the staff member", "");
                      if (note == null) return;
                      void post(
                        { action: "review", staffId: row.staffId, weekStart: row.weekStart, decision: "return", reviewNote: note },
                        `${row.staffId}-return`,
                      );
                    }}
                  >
                    Send back
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-text-primary">Clinic days off</h2>
        <form
          className="mt-3 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            post({ action: "weekly-off", days: data.getAll("off").map(String) }, "off");
          }}
        >
          <div className="flex flex-wrap gap-3">
            {WEEKDAYS.map((day) => (
              <label key={day.value} className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" name="off" value={day.value} defaultChecked={weeklyOffDays.includes(day.value)} />
                {day.label}
              </label>
            ))}
          </div>
          <button type="submit" className={secondaryButtonClass} disabled={busy === "off"}>
            Save weekly off
          </button>
        </form>
        <form
          className="mt-4 grid gap-2 sm:grid-cols-[10rem_1fr_auto] sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            void post({ action: "holiday", date: String(data.get("date")), name: String(data.get("name")) }, "holiday");
            event.currentTarget.reset();
          }}
        >
          <input name="date" type="date" required className={fieldClass} />
          <input name="name" placeholder="Holiday name" required className={fieldClass} />
          <button type="submit" className={secondaryButtonClass} disabled={busy === "holiday"}>
            Add holiday
          </button>
        </form>
        <ul className="mt-3 space-y-1">
          {holidays.map((holiday) => (
            <li key={holiday.id} className="flex items-center justify-between gap-2 text-sm">
              <span>
                {holiday.date} · {holiday.name}
              </span>
              <button type="button" className="text-xs text-red-600" onClick={() => post({ action: "remove-holiday", id: holiday.id }, holiday.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-text-secondary">{holidays.length} holiday {holidays.length === 1 ? "date" : "dates"} added.</p>
      </section>

      <section className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-border text-xs text-text-secondary">
            <tr>
              <th className="px-3 py-2 font-medium">Staff</th>
              <th className="px-3 py-2 font-medium">Paid days</th>
              <th className="px-3 py-2 font-medium">Unpaid</th>
              <th className="px-3 py-2 font-medium">Leave used</th>
              <th className="px-3 py-2 font-medium">Salary</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((person) => (
              <tr key={person.id} className="border-b border-border last:border-0">
                <td className="px-3 py-2 font-medium">{person.name}</td>
                <td className="px-3 py-2">{person.salary ? person.salary.paidDays : "—"}</td>
                <td className="px-3 py-2">{person.salary ? person.salary.unpaidDays : "—"}</td>
                <td className="px-3 py-2">
                  {person.salary
                    ? `${person.salary.casualUsedYear} of ${person.casualLeaveDays} casual, ${person.salary.sickUsedYear} of ${person.sickLeaveDays} sick`
                    : "Pay not set"}
                </td>
                <td className="px-3 py-2">{person.salary ? inr(person.salary.amount) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-text-primary">Pay for each person</h2>
        {staff.map((person) => (
          <form
            key={person.id}
            className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              void post(
                {
                  action: "pay",
                  staffId: person.id,
                  payBasis: String(data.get("payBasis")),
                  monthlyAmount: String(data.get("monthlyAmount") || ""),
                  dailyRate: String(data.get("dailyRate") || ""),
                  monthDivisor: String(data.get("monthDivisor")),
                  casualLeaveDays: String(data.get("casualLeaveDays") || "0"),
                  sickLeaveDays: String(data.get("sickLeaveDays") || "0"),
                },
                person.id,
              );
            }}
          >
            <p className="text-sm font-medium sm:col-span-2">{person.name}</p>
            <label className="text-xs text-text-secondary">
              Pay style
              <select name="payBasis" defaultValue={person.payBasis} className={fieldClass}>
                <option value="MONTHLY">Monthly amount</option>
                <option value="DAILY">Daily rate</option>
              </select>
            </label>
            <label className="text-xs text-text-secondary">
              Divide a monthly salary by
              <select name="monthDivisor" defaultValue={person.monthDivisor} className={fieldClass}>
                <option value="FIXED_30">30 days</option>
                <option value="CALENDAR_DAYS">Days in the month</option>
              </select>
            </label>
            <label className="text-xs text-text-secondary">
              Monthly salary
              <input name="monthlyAmount" inputMode="decimal" defaultValue={person.monthlyAmount} className={fieldClass} />
            </label>
            <label className="text-xs text-text-secondary">
              Daily rate
              <input name="dailyRate" inputMode="decimal" defaultValue={person.dailyRate} className={fieldClass} />
            </label>
            <label className="text-xs text-text-secondary">
              Paid casual leave days a year
              <input name="casualLeaveDays" type="number" min={0} defaultValue={person.casualLeaveDays} className={fieldClass} />
            </label>
            <label className="text-xs text-text-secondary">
              Paid sick leave days a year
              <input name="sickLeaveDays" type="number" min={0} defaultValue={person.sickLeaveDays} className={fieldClass} />
            </label>
            <div className="sm:col-span-2">
              <button type="submit" className={primaryButtonClass} disabled={busy === person.id}>
                Save pay
              </button>
            </div>
          </form>
        ))}
      </section>
    </div>
  );
}
