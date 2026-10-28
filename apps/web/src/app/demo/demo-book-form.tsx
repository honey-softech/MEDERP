"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthShell, fieldClass, primaryButtonClass, textareaClass } from "@/components/auth-shell";
import { addDaysToDateKey, dateKeyInZone } from "@/lib/demo/slots";

type Slot = { startsAt: string; endsAt: string; label: string };

export function DemoBookForm() {
  const router = useRouter();
  const [timeZone, setTimeZone] = useState("Asia/Kolkata");
  const [horizon, setHorizon] = useState(14);
  const today = dateKeyInZone(new Date(), timeZone);
  const [date, setDate] = useState(today);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsError, setSlotsError] = useState("");
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [startsAt, setStartsAt] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [organization, setOrganization] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const lastDate = addDaysToDateKey(today, Math.max(horizon, 1) - 1);

  useEffect(() => {
    let cancelled = false;
    setSlotsLoading(true);
    setSlotsError("");
    setStartsAt("");
    void fetch(`/api/public/demo/slots?date=${encodeURIComponent(date)}`)
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error ?? "Could not load slots.");
        if (!cancelled) {
          setSlots(data.slots ?? []);
          if (typeof data.lookAheadDays === "number") setHorizon(data.lookAheadDays);
          if (typeof data.timezone === "string" && data.timezone) setTimeZone(data.timezone);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setSlots([]);
          setSlotsError(err.message);
        }
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [date]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!startsAt) {
      setError("Choose a time slot.");
      return;
    }
    setPending(true);
    const response = await fetch("/api/public/demo/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, phone, organization, notes, startsAt }),
    });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not book the demo.");
      return;
    }
    router.push(`/demo/confirmed?token=${encodeURIComponent(data.cancelToken)}`);
  }

  const chosen = slots.find((slot) => slot.startsAt === startsAt);

  return (
    <AuthShell
      kicker="Walkthrough"
      title="Book a demo"
      subtitle="Tell us about your clinic, then pick an open time. Google Calendar will email the invite and Meet link."
      doodles
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <label className="block text-sm font-medium text-slate-700">
          Name
          <input className={`${fieldClass} mt-1`} value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Email
          <input
            className={`${fieldClass} mt-1`}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Mobile
          <input className={`${fieldClass} mt-1`} value={phone} onChange={(event) => setPhone(event.target.value)} />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Clinic or hospital
          <input
            className={`${fieldClass} mt-1`}
            value={organization}
            onChange={(event) => setOrganization(event.target.value)}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          What do you want to see?
          <textarea className={`${textareaClass} mt-1`} value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} />
        </label>

        <fieldset className="space-y-2 border-t border-slate-200 pt-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <label className="block min-w-[10rem] text-sm font-medium text-slate-700">
              Date
              <input
                className={`${fieldClass} mt-1`}
                type="date"
                min={today}
                max={lastDate}
                value={date}
                onChange={(event) => setDate(event.target.value)}
                required
              />
            </label>
            <p className="pb-2 text-sm text-slate-600">
              {chosen ? <span className="font-medium text-teal-800">{chosen.label}</span> : "Choose a time"}
            </p>
          </div>
          {slotsLoading ? <p className="text-sm text-slate-500">Loading times…</p> : null}
          {slotsError ? <p className="text-sm text-red-600">{slotsError}</p> : null}
          {!slotsLoading && !slotsError && slots.length === 0 ? (
            <p className="text-sm text-slate-500">No open times on this day.</p>
          ) : null}
          {slots.length > 0 ? (
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
              {slots.map((slot) => {
                const selected = startsAt === slot.startsAt;
                return (
                  <button
                    key={slot.startsAt}
                    type="button"
                    aria-pressed={selected}
                    className={`h-8 rounded-md px-2 text-xs font-medium ${
                      selected
                        ? "bg-primary text-white"
                        : "border border-slate-200 bg-white text-slate-700 hover:border-primary hover:bg-primary-light"
                    }`}
                    onClick={() => setStartsAt(slot.startsAt)}
                  >
                    {slot.label}
                  </button>
                );
              })}
            </div>
          ) : null}
        </fieldset>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button className={`${primaryButtonClass} w-full`} type="submit" disabled={pending}>
          {pending ? "Booking…" : "Book demo"}
        </button>
        <p className="text-sm text-slate-500">
          Already a customer?{" "}
          <Link className="font-medium text-teal-700 hover:underline" href="/login">
            Sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
