"use client";

import { useEffect, useState } from "react";
import { buttonClass, fieldClass } from "@/components/auth-shell";

type Settings = {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  gstin: string;
  invoicePrefix: string;
  bankDetails: string;
  termsNote: string;
  basePackageFee: number;
  includedStaffSlots: number;
  extraUserFee: number;
  pharmacyModuleFee: number;
  labModuleFee: number;
};

export function PlatformBillingSettingsForm() {
  const [settings, setSettings] = useState<Settings>({
    companyName: "",
    companyAddress: "",
    companyPhone: "",
    companyEmail: "",
    gstin: "",
    invoicePrefix: "MEDERP",
    bankDetails: "",
    termsNote: "",
    basePackageFee: 4000,
    includedStaffSlots: 3,
    extraUserFee: 1000,
    pharmacyModuleFee: 1000,
    labModuleFee: 1000,
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void fetch("/api/platform/billing-settings")
      .then((response) => response.json())
      .then((data) => {
        if (!data.settings) return;
        const row = data.settings;
        setSettings({
          companyName: row.companyName ?? "",
          companyAddress: row.companyAddress ?? "",
          companyPhone: row.companyPhone ?? "",
          companyEmail: row.companyEmail ?? "",
          gstin: row.gstin ?? "",
          invoicePrefix: row.invoicePrefix ?? "MEDERP",
          bankDetails: row.bankDetails ?? "",
          termsNote: row.termsNote ?? "",
          basePackageFee: Number(row.basePackageFee),
          includedStaffSlots: Number(row.includedStaffSlots),
          extraUserFee: Number(row.extraUserFee),
          pharmacyModuleFee: Number(row.pharmacyModuleFee),
          labModuleFee: Number(row.labModuleFee),
        });
      })
      .catch(() => null);
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    setMessage("");
    const response = await fetch("/api/platform/billing-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    const data = await response.json();
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not save settings.");
      return;
    }
    setMessage("Billing settings saved.");
  }

  function field(key: keyof Settings, label: string, type: "text" | "number" | "textarea" = "text") {
    const value = settings[key];
    return (
      <label className="text-sm font-medium text-slate-700">
        {label}
        {type === "textarea" ? (
          <textarea
            className={`${fieldClass} min-h-24`}
            value={String(value)}
            onChange={(event) => setSettings((current) => ({ ...current, [key]: event.target.value }))}
          />
        ) : (
          <input
            className={fieldClass}
            type={type}
            value={type === "number" ? Number(value) : String(value)}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                [key]: type === "number" ? Number(event.target.value) : event.target.value,
              }))
            }
          />
        )}
      </label>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid max-w-4xl gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 md:grid-cols-2">
      <h3 className="md:col-span-2 font-semibold">Company billing details</h3>
      <p className="md:col-span-2 text-sm text-slate-600">
        These details appear on platform invoices issued to hospitals. Online payment and auto-renew will use this later.
      </p>
      {field("companyName", "Company name")}
      {field("invoicePrefix", "Invoice prefix")}
      {field("companyPhone", "Phone")}
      {field("companyEmail", "Email")}
      {field("gstin", "GSTIN")}
      <label className="md:col-span-2 text-sm font-medium text-slate-700">
        Address
        <textarea
          className={`${fieldClass} min-h-20`}
          value={settings.companyAddress}
          onChange={(event) => setSettings((current) => ({ ...current, companyAddress: event.target.value }))}
        />
      </label>
      {field("bankDetails", "Bank / UPI details", "textarea")}
      {field("termsNote", "Terms on invoice", "textarea")}

      <h4 className="md:col-span-2 mt-2 font-semibold">Default pricing (₹)</h4>
      {field("basePackageFee", "Base package fee", "number")}
      {field("includedStaffSlots", "Included staff slots", "number")}
      {field("extraUserFee", "Extra user fee", "number")}
      {field("pharmacyModuleFee", "Pharmacy module fee", "number")}
      {field("labModuleFee", "Lab module fee", "number")}

      {error ? <p className="md:col-span-2 text-sm text-red-600">{error}</p> : null}
      {message ? <p className="md:col-span-2 text-sm text-teal-700">{message}</p> : null}
      <div className="md:col-span-2">
        <button className={buttonClass} type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save billing settings"}
        </button>
      </div>
    </form>
  );
}
