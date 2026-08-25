"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClass, fieldClass } from "@/components/auth-shell";
import { PhotoCapture } from "@/components/photo-capture";

export function HospitalBrandingForm({
  initial,
}: {
  initial: {
    name: string;
    code: string;
    address: string;
    phone: string;
    logoData: string;
    sealData: string;
    opdFee: string;
  };
}) {
  const router = useRouter();
  const [address, setAddress] = useState(initial.address);
  const [phone, setPhone] = useState(initial.phone);
  const [opdFee, setOpdFee] = useState(initial.opdFee);
  const [logoData, setLogoData] = useState(initial.logoData);
  const [sealData, setSealData] = useState(initial.sealData);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSaved(false);
    setPending(true);
    const response = await fetch("/api/hospital/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, phone, logoData, sealData, opdFee: Number(opdFee) }),
    });
    const data = await response.json().catch(() => ({ error: "Could not save branding." }));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not save branding.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid max-w-5xl gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 md:grid-cols-2">
      <div className="md:col-span-2">
        <h3 className="font-semibold">Hospital print branding</h3>
        <p className="mt-1 text-sm text-slate-500">
          These details appear on the visit summary that doctors and reception print after assessment.
        </p>
      </div>
      <p className="text-sm font-medium text-slate-700">
        Hospital
        <span className={`${fieldClass} mt-1 block bg-slate-50`}>{initial.name} · {initial.code}</span>
      </p>
      <label className="text-sm font-medium text-slate-700">
        Phone
        <input className={fieldClass} value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+91 ..." />
      </label>
      <label className="md:col-span-2 text-sm font-medium text-slate-700">
        Address
        <textarea
          className={fieldClass}
          rows={3}
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          placeholder="Street, area, city, PIN"
        />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Default OPD amount (₹)
        <input
          className={fieldClass}
          type="number"
          min="0"
          step="0.01"
          value={opdFee}
          onChange={(event) => setOpdFee(event.target.value)}
        />
        <span className="mt-1 block font-normal text-slate-500">
          Used on the OPD queue payment screen. Reception can still enter a different amount for a visit. Default is 500.
        </span>
      </label>
      <div className="md:col-span-2">
        <PhotoCapture
          variant="logo"
          value={logoData}
          onChange={setLogoData}
          label="Hospital logo (right side of print header)"
        />
      </div>
      <div className="md:col-span-2">
        <PhotoCapture
          variant="logo"
          value={sealData}
          onChange={setSealData}
          label="Accreditation / seal icon (left side of print header, optional)"
        />
      </div>
      {error ? <p className="md:col-span-2 text-sm text-red-600">{error}</p> : null}
      {saved ? <p className="md:col-span-2 text-sm text-teal-700">Branding saved. It will show on the next printed visit summary.</p> : null}
      <div className="md:col-span-2">
        <button className={buttonClass} type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save hospital branding"}
        </button>
      </div>
    </form>
  );
}
