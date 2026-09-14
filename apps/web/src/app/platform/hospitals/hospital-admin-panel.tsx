"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonClass, fieldClass, secondaryButtonClass } from "@/components/auth-shell";

function toDateInput(value?: string | Date | null) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function HospitalAdminPanel({
  hospitalId,
  initial,
}: {
  hospitalId: string;
  initial: {
    name: string;
    code: string;
    address: string;
    phone: string;
    isActive: boolean;
    opdFee: number;
    extraStaffSlots: number;
    trialEndsAt?: string | Date | null;
  };
}) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [code, setCode] = useState(initial.code);
  const [address, setAddress] = useState(initial.address);
  const [phone, setPhone] = useState(initial.phone);
  const [opdFee, setOpdFee] = useState(String(initial.opdFee));
  const [extraStaffSlots, setExtraStaffSlots] = useState(String(initial.extraStaffSlots));
  const [trialEndsAt, setTrialEndsAt] = useState(toDateInput(initial.trialEndsAt));
  const [isActive, setIsActive] = useState(initial.isActive);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    setPending(true);
    const response = await fetch(`/api/platform/hospitals/${hospitalId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        code,
        address,
        phone,
        opdFee: Number(opdFee),
        extraStaffSlots: Number(extraStaffSlots),
        trialEndsAt: trialEndsAt ? new Date(`${trialEndsAt}T23:59:59.000Z`).toISOString() : null,
        isActive,
      }),
    });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not update hospital.");
      return;
    }
    if (data.hospital?.code) setCode(data.hospital.code);
    setMessage(isActive ? "Hospital details saved. Access is enabled." : "Hospital details saved. Access is disabled.");
    router.refresh();
  }

  async function toggleAccess() {
    setError("");
    setMessage("");
    setPending(true);
    const next = !isActive;
    const response = await fetch(`/api/platform/hospitals/${hospitalId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: next }),
    });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not update hospital access.");
      return;
    }
    setIsActive(next);
    setMessage(next ? "Hospital access enabled." : "Hospital access stopped. Users cannot sign in.");
    router.refresh();
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Hospital details & access</h3>
          <p className="mt-1 text-sm text-slate-500">
            Software admin can edit hospital profile, grant extra seats, extend trial, and stop or restore access.
          </p>
        </div>
        <button
          type="button"
          className={isActive ? secondaryButtonClass : buttonClass}
          disabled={pending}
          onClick={() => void toggleAccess()}
        >
          {isActive ? "Stop hospital access" : "Enable hospital access"}
        </button>
      </div>

      <form onSubmit={save} className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">
          Hospital name
          <input className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Hospital code
          <input
            className={fieldClass}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            required
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Address
          <input className={fieldClass} value={address} onChange={(e) => setAddress(e.target.value)} />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Phone
          <input className={fieldClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Default OPD fee (₹)
          <input
            className={fieldClass}
            type="number"
            min={0}
            step="1"
            value={opdFee}
            onChange={(e) => setOpdFee(e.target.value)}
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Extra staff seats
          <input
            className={fieldClass}
            type="number"
            min={0}
            max={500}
            step="1"
            value={extraStaffSlots}
            onChange={(e) => setExtraStaffSlots(e.target.value)}
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Trial ends on
          <input
            className={fieldClass}
            type="date"
            value={trialEndsAt}
            onChange={(e) => setTrialEndsAt(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-2 self-end text-sm text-slate-700">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Hospital is active (users can sign in)
        </label>
        {error ? <p className="sm:col-span-2 text-sm text-red-600">{error}</p> : null}
        {message ? <p className="sm:col-span-2 text-sm text-teal-700">{message}</p> : null}
        <button className={`${buttonClass} sm:col-span-2`} type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save hospital details"}
        </button>
      </form>
    </section>
  );
}
