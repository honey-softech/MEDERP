"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthShell, buttonClass, fieldClass, secondaryButtonClass } from "@/components/auth-shell";
import { HELPDESK_CATEGORIES } from "@/lib/helpdesk-options";
import { isValidIndianMobile, mobileValidationError, normalizeMobile } from "@/lib/phone";

export default function PublicHelpPage() {
  const [step, setStep] = useState<"otp" | "form" | "done">("otp");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [contactName, setContactName] = useState("");
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("ACCESS");
  const [body, setBody] = useState("");
  const [ticketNumber, setTicketNumber] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [pending, setPending] = useState(false);

  async function requestOtp(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setInfo("");
    const mobileError = mobileValidationError(mobile, "Mobile number");
    if (mobileError) {
      setError(mobileError);
      return;
    }
    setPending(true);
    const normalized = normalizeMobile(mobile);
    const response = await fetch("/api/public/help-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "request-otp", mobile: normalized }),
    });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not send OTP.");
      return;
    }
    setMobile(normalized);
    setInfo(data.message ?? "If that mobile is registered, an OTP has been sent.");
    setStep("form");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setInfo("");
    if (!isValidIndianMobile(normalizeMobile(mobile))) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }
    setPending(true);
    const response = await fetch("/api/public/help-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        step: "submit",
        mobile: normalizeMobile(mobile),
        otp,
        contactName,
        subject,
        category,
        body,
        priority: "HIGH",
      }),
    });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not submit help request.");
      return;
    }
    setTicketNumber(data.ticket?.number ?? "");
    setStep("done");
  }

  if (step === "done") {
    return (
      <AuthShell title="Request submitted" subtitle="MedERP support has your ticket.">
        <p className="text-sm text-slate-700">
          Your request {ticketNumber ? <span className="font-mono font-semibold">{ticketNumber}</span> : null}{" "}
          is with the support team. If your account can sign in again after they fix it, use the login page.
        </p>
        <Link href="/login" className={`${buttonClass} mt-6 block text-center`}>
          Back to sign in
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Need help signing in?"
      subtitle="Verify your registered mobile, then tell us what went wrong. Works even if your account was deactivated."
    >
      {step === "otp" ? (
        <form onSubmit={requestOtp} className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Registered mobile
            <input
              className={fieldClass}
              inputMode="numeric"
              maxLength={13}
              value={mobile}
              onChange={(event) => setMobile(event.target.value.replace(/[^\d+]/g, ""))}
              placeholder="10-digit mobile"
              required
            />
          </label>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {info ? <p className="text-sm text-teal-700">{info}</p> : null}
          <button className={buttonClass} type="submit" disabled={pending}>
            {pending ? "Sending…" : "Send OTP"}
          </button>
        </form>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-slate-500">Mobile {mobile}</p>
          <label className="block text-sm font-medium text-slate-700">
            OTP
            <input
              className={fieldClass}
              inputMode="numeric"
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
              required
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Your name
            <input className={fieldClass} value={contactName} onChange={(event) => setContactName(event.target.value)} />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Category
            <select className={fieldClass} value={category} onChange={(event) => setCategory(event.target.value)}>
              {HELPDESK_CATEGORIES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Subject
            <input className={fieldClass} value={subject} onChange={(event) => setSubject(event.target.value)} required />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            What went wrong?
            <textarea
              className={fieldClass}
              rows={4}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              required
            />
          </label>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {info ? <p className="text-sm text-teal-700">{info}</p> : null}
          <button className={buttonClass} type="submit" disabled={pending}>
            {pending ? "Submitting…" : "Submit help request"}
          </button>
          <button
            type="button"
            className={`${secondaryButtonClass} mt-2 w-full`}
            onClick={() => {
              setStep("otp");
              setOtp("");
              setError("");
              setInfo("");
            }}
          >
            Use a different mobile
          </button>
        </form>
      )}
      <p className="mt-4 text-center text-sm text-slate-500">
        Already submitted a request?{" "}
        <Link className="font-medium text-teal-700 hover:underline" href="/help/status">
          Check status
        </Link>
        {" · "}
        <Link className="font-medium text-teal-700 hover:underline" href="/login">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
