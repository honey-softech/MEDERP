"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buttonClass, fieldClass, secondaryButtonClass } from "@/components/auth-shell";
import { mobileValidationError } from "@/lib/phone";

type TierInfo = {
  id: string;
  name: string;
  tagline: string;
  monthlyFee: number;
  seatLimit: number | null;
  roleSuggestion: string;
  features: string[];
};

function inr(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
    value,
  );
}

export function AddHospitalForm() {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [adminUsername, setAdminUsername] = useState("");
  const [adminMobile, setAdminMobile] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [tierId, setTierId] = useState("STARTER");
  const paymentMethod: "UPI" = "UPI";
  const [paymentNotes, setPaymentNotes] = useState("");
  const [tiers, setTiers] = useState<TierInfo[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [codeBusy, setCodeBusy] = useState(false);
  const lastFetchedName = useRef("");

  useEffect(() => {
    void fetch("/api/public/package")
      .then((response) => response.json())
      .then((data) => {
        if (data.package?.tiers) setTiers(data.package.tiers);
      })
      .catch(() => null);
  }, []);

  async function assignHospitalCode(hospitalName: string) {
    if (hospitalName.trim().length < 2) return;
    setCodeBusy(true);
    try {
      const response = await fetch(`/api/public/hospital-code?name=${encodeURIComponent(hospitalName.trim())}`);
      const data = await response.json().catch(() => ({}));
      if (data.code) setCode(String(data.code));
    } finally {
      setCodeBusy(false);
    }
  }

  useEffect(() => {
    const trimmed = name.trim();
    if (trimmed.length < 2 || lastFetchedName.current === trimmed) return;
    const handle = window.setTimeout(() => {
      lastFetchedName.current = trimmed;
      void assignHospitalCode(trimmed);
    }, 400);
    return () => window.clearTimeout(handle);
  }, [name]);

  const selected = useMemo(() => tiers.find((tier) => tier.id === tierId) ?? null, [tiers, tierId]);
  const quote = useMemo(() => {
    if (!selected) return null;
    return {
      lines: [{ description: `${selected.name} plan`, amount: selected.monthlyFee }],
      total: selected.monthlyFee,
    };
  }, [selected]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    const hospitalMobileError = mobileValidationError(phone, "Hospital mobile");
    if (hospitalMobileError) {
      setError(hospitalMobileError);
      return;
    }
    const adminMobileError = mobileValidationError(adminMobile, "Super admin mobile");
    if (adminMobileError) {
      setError(adminMobileError);
      return;
    }
    setPending(true);

    const response = await fetch("/api/platform/hospitals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        code,
        address,
        phone,
        adminUsername,
        adminMobile,
        adminPassword,
        tierId,
        paymentMethod,
        paymentNotes,
      }),
    });
    const data = await response.json();
    setPending(false);

    if (!response.ok) {
      setError(data.error ?? "Could not add hospital.");
      return;
    }

    setMessage(
      `Hospital ${data.hospital.code} created. Platform invoice ${data.invoice?.invoiceNo ?? ""} · ${inr(Number(data.invoice?.netTotal ?? 0))}.`,
    );
    window.location.href = `/platform/hospitals/${data.hospital.id}`;
  }

  return (
    <form onSubmit={onSubmit} className="grid max-w-4xl gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 md:grid-cols-2">
      <h3 className="md:col-span-2 font-semibold">Register hospital and super admin</h3>

      <label className="text-sm font-medium text-slate-700">
        Hospital name
        <input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} required />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Hospital code
        <input className={`${fieldClass} bg-slate-50`} value={code} readOnly required />
        <button
          className={`${secondaryButtonClass} mt-2`}
          type="button"
          disabled={codeBusy || name.trim().length < 2}
          onClick={() => void assignHospitalCode(name)}
        >
          {codeBusy ? "Assigning…" : "Generate another code"}
        </button>
      </label>
      <label className="text-sm font-medium text-slate-700">
        Address
        <input className={fieldClass} value={address} onChange={(event) => setAddress(event.target.value)} />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Hospital mobile
        <input
          className={fieldClass}
          inputMode="numeric"
          maxLength={13}
          value={phone}
          onChange={(event) => setPhone(event.target.value.replace(/[^\d+]/g, ""))}
          placeholder="10-digit mobile"
          required
        />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Super admin username
        <input className={fieldClass} value={adminUsername} onChange={(event) => setAdminUsername(event.target.value)} required />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Super admin mobile
        <input
          className={fieldClass}
          inputMode="numeric"
          maxLength={13}
          value={adminMobile}
          onChange={(event) => setAdminMobile(event.target.value.replace(/[^\d+]/g, ""))}
          placeholder="10-digit mobile — used to sign in"
          required
        />
      </label>
      <label className="md:col-span-2 text-sm font-medium text-slate-700">
        Super admin password
        <input
          className={fieldClass}
          type="password"
          value={adminPassword}
          onChange={(event) => setAdminPassword(event.target.value)}
          required
        />
      </label>

      <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h4 className="font-semibold text-slate-800">Subscription plan</h4>
        <p className="mt-1 text-sm text-slate-600">
          Fixed monthly plans. Seat suggestions are guidance only — hospitals may assign any staff roles within the limit.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {tiers.map((tier) => (
            <button
              key={tier.id}
              type="button"
              onClick={() => setTierId(tier.id)}
              className={`rounded-xl border p-3 text-left ${
                tierId === tier.id ? "border-teal-600 bg-white ring-2 ring-teal-600/20" : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex justify-between gap-2">
                <p className="font-semibold">{tier.name}</p>
                <p className="text-sm font-semibold text-teal-800">{inr(tier.monthlyFee)}/mo</p>
              </div>
              <p className="mt-1 text-xs text-slate-500">{tier.roleSuggestion}</p>
            </button>
          ))}
        </div>
        {quote ? (
          <ul className="mt-4 space-y-1 border-t border-slate-200 pt-3 text-sm">
            {quote.lines.map((line) => (
              <li key={line.description} className="flex justify-between gap-3">
                <span className="text-slate-700">{line.description}</span>
                <span className="font-medium">{inr(line.amount)}</span>
              </li>
            ))}
            <li className="flex justify-between gap-3 border-t border-slate-200 pt-2 font-semibold">
              <span>Registration total</span>
              <span>{inr(quote.total)}</span>
            </li>
          </ul>
        ) : null}
      </div>

      <p className="text-sm font-medium text-slate-700">Payment received: Online (UPI)</p>
      <label className="text-sm font-medium text-slate-700">
        Payment reference / notes
        <input className={fieldClass} value={paymentNotes} onChange={(event) => setPaymentNotes(event.target.value)} placeholder="UPI ref, receipt no…" />
      </label>

      {error ? <p className="md:col-span-2 text-sm text-red-600">{error}</p> : null}
      {message ? <p className="md:col-span-2 text-sm text-teal-700">{message}</p> : null}
      <div className="md:col-span-2">
        <button className={buttonClass} type="submit" disabled={pending}>
          {pending ? "Creating…" : quote ? `Create hospital · ${inr(quote.total)}` : "Create hospital"}
        </button>
      </div>
    </form>
  );
}
