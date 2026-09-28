"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthShell, fieldClass, primaryButtonClass, secondaryButtonClass, textareaClass } from "@/components/auth-shell";
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

  return (
    <AuthShell
      title="Book a MedERP demo"
      subtitle="Pick an open slot. Google Calendar will email you the invite and Meet link."
      wide
    >
      <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <div>
          <label className="block text-sm font-medium text-slate-700">
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
          <div className="mt-3 grid gap-2">
            {slotsLoading ? <p className="text-sm text-slate-500">Loading slots…</p> : null}
            {slotsError ? <p className="text-sm text-red-600">{slotsError}</p> : null}
            {!slotsLoading && !slotsError && slots.length === 0 ? (
              <p className="text-sm text-slate-500">No open slots on this day.</p>
            ) : null}
            {slots.map((slot) => (
              <button
                key={slot.startsAt}
                type="button"
                className={startsAt === slot.startsAt ? primaryButtonClass : secondaryButtonClass}
                onClick={() => setStartsAt(slot.startsAt)}
              >
                {slot.label}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-3">
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
            <textarea className={`${textareaClass} mt-1`} value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
          </label>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button className={primaryButtonClass} type="submit" disabled={pending}>
            {pending ? "Booking…" : "Book demo"}
          </button>
          <p className="text-sm text-slate-500">
            Already a customer?{" "}
            <Link className="font-medium text-teal-700 hover:underline" href="/login">
              Sign in
            </Link>
          </p>
        </div>
      </form>
    </AuthShell>
  );
}
