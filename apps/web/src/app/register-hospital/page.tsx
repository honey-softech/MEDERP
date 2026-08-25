"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AuthShell, buttonClass, fieldClass, secondaryButtonClass } from "@/components/auth-shell";
import { mobileValidationError } from "@/lib/phone";
import {
  clearRegisterHospitalDraft,
  loadRegisterHospitalDraft,
  saveRegisterHospitalDraft,
} from "@/lib/register-hospital-draft";
import {
  isOrderCheckoutSuccess,
  loadRazorpayCheckoutScript,
  type RazorpayCheckoutSuccess,
} from "@/lib/razorpay-checkout";

type TierInfo = {
  id: string;
  name: string;
  tagline: string;
  monthlyFee: number;
  seatLimit: number | null;
  roleSuggestion: string;
  pharmacyEnabled: boolean;
  labEnabled: boolean;
  inventoryEnabled: boolean;
  features: string[];
};

type PackageInfo = {
  companyName: string;
  bankDetails: string | null;
  razorpayEnabled: boolean;
  tiers: TierInfo[];
};

function inr(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function RegisterHospitalPage() {
  const router = useRouter();
  const [pkg, setPkg] = useState<PackageInfo | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [adminUsername, setAdminUsername] = useState("");
  const [adminMobile, setAdminMobile] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [tierId, setTierId] = useState("STARTER");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const skipCodeFetch = useRef(true);
  const lastFetchedName = useRef("");
  const [codeBusy, setCodeBusy] = useState(false);
  const [draftReady, setDraftReady] = useState(false);

  useEffect(() => {
    const draft = loadRegisterHospitalDraft();
    if (draft) {
      setName(draft.name);
      setCode(draft.code);
      setAddress(draft.address);
      setPhone(draft.phone);
      setAdminUsername(draft.adminUsername);
      setAdminMobile(draft.adminMobile);
      setTierId(draft.tierId || "STARTER");
      setTermsAccepted(draft.termsAccepted);
      skipCodeFetch.current = Boolean(draft.code);
      lastFetchedName.current = draft.name.trim();
    }
    setDraftReady(true);
    void fetch("/api/public/package")
      .then((response) => response.json())
      .then((data) => {
        if (data.package) setPkg(data.package);
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    saveRegisterHospitalDraft({
      name,
      code,
      address,
      phone,
      adminUsername,
      adminMobile,
      tierId,
      termsAccepted,
    });
  }, [draftReady, name, code, address, phone, adminUsername, adminMobile, tierId, termsAccepted]);

  async function assignHospitalCode(hospitalName: string, keep?: string) {
    if (hospitalName.trim().length < 2) return;
    setCodeBusy(true);
    const query = new URLSearchParams({ name: hospitalName.trim() });
    if (keep) query.set("code", keep);
    try {
      const response = await fetch(`/api/public/hospital-code?${query.toString()}`);
      const data = await response.json().catch(() => ({}));
      if (data.code) setCode(String(data.code));
    } finally {
      setCodeBusy(false);
    }
  }

  useEffect(() => {
    if (!draftReady) return;
    const trimmed = name.trim();
    if (trimmed.length < 2) return;
    if (skipCodeFetch.current && code) {
      skipCodeFetch.current = false;
      lastFetchedName.current = trimmed;
      return;
    }
    if (lastFetchedName.current === trimmed) return;
    const handle = window.setTimeout(() => {
      lastFetchedName.current = trimmed;
      void assignHospitalCode(trimmed);
    }, 400);
    return () => window.clearTimeout(handle);
  }, [draftReady, name, code]);

  const selectedTier = useMemo(
    () => pkg?.tiers.find((tier) => tier.id === tierId) ?? null,
    [pkg, tierId],
  );

  const quote = useMemo(() => {
    if (!selectedTier) return null;
    return {
      lines: [{ description: `${selectedTier.name} plan`, amount: selectedTier.monthlyFee }],
      total: selectedTier.monthlyFee,
      maxStaff: selectedTier.seatLimit,
    };
  }, [selectedTier]);

  const registrationPayload = useMemo(
    () => ({
      name,
      code,
      address,
      phone,
      adminUsername,
      adminMobile,
      adminPassword,
      tierId,
      termsAccepted,
    }),
    [name, code, address, phone, adminUsername, adminMobile, adminPassword, tierId, termsAccepted],
  );

  async function completeRegistration(
    payment: RazorpayCheckoutSuccess,
    meta: { mode: "subscription" | "order"; planId?: string },
  ) {
    const response = await fetch("/api/public/register-hospital", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...registrationPayload,
        mode: meta.mode,
        planId: meta.planId,
        ...(isOrderCheckoutSuccess(payment)
          ? {
              razorpay_order_id: payment.razorpay_order_id,
              razorpay_payment_id: payment.razorpay_payment_id,
              razorpay_signature: payment.razorpay_signature,
            }
          : {
              razorpay_subscription_id: payment.razorpay_subscription_id,
              razorpay_payment_id: payment.razorpay_payment_id,
              razorpay_signature: payment.razorpay_signature,
            }),
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setPending(false);
      setError(data.error ?? "Payment succeeded but hospital registration failed. Contact support with your payment ID.");
      return;
    }
    clearRegisterHospitalDraft();
    router.push(data.redirectTo || "/");
    router.refresh();
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!termsAccepted) {
      setError("Accept the Terms & Conditions to continue.");
      return;
    }
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
    if (!adminPassword || adminPassword.length < 6) {
      setError("Super admin password must be at least 6 characters.");
      return;
    }
    setPending(true);

    try {
      if (!pkg?.razorpayEnabled) {
        setError(
          "Online payment is not configured on the server. Add RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, and NEXT_PUBLIC_RAZORPAY_KEY_ID in Railway → MEDERP → Variables, then redeploy.",
        );
        setPending(false);
        return;
      }

      const orderResponse = await fetch("/api/public/register-hospital/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registrationPayload),
      });
      const raw = await orderResponse.text();
      let orderData: Record<string, unknown> = {};
      try {
        orderData = raw ? JSON.parse(raw) : {};
      } catch {
        orderData = {};
      }
      if (!orderResponse.ok) {
        setError(String(orderData.error ?? `Could not start payment (${orderResponse.status}).`));
        setPending(false);
        return;
      }

      const mode: "subscription" | "order" = orderData.mode === "order" ? "order" : "subscription";
      if (orderData.notice) {
        setNotice(String(orderData.notice));
      }

      const scriptReady = await loadRazorpayCheckoutScript();
      if (!scriptReady || !window.Razorpay) {
        setError("Could not load Razorpay Checkout. Check your network and try again.");
        setPending(false);
        return;
      }

      const checkout = new window.Razorpay({
        key: String(orderData.keyId ?? ""),
        ...(mode === "subscription"
          ? { subscription_id: String(orderData.subscriptionId ?? "") }
          : {
              order_id: String(orderData.orderId ?? ""),
              amount: Number(orderData.amount),
              currency: String(orderData.currency || "INR"),
            }),
        name: "MedERP",
        description:
          mode === "subscription"
            ? `Monthly subscription — ${String(orderData.hospitalName || name)}`
            : `Hospital registration — ${String(orderData.hospitalName || name)}`,
        prefill: {
          name: String((orderData.prefill as { name?: string } | undefined)?.name || adminUsername),
          contact: String((orderData.prefill as { contact?: string } | undefined)?.contact || adminMobile),
        },
        theme: { color: "#1976d2" },
        handler: (response) => {
          void completeRegistration(response, { mode, planId: orderData.planId ? String(orderData.planId) : undefined });
        },
        modal: {
          ondismiss: () => {
            setPending(false);
            if (mode === "subscription" && orderData.shortUrl) {
              setNotice(
                "Checkout was closed. You can complete the same monthly subscription on Razorpay’s hosted page if card lookup fails.",
              );
              setError("");
              return;
            }
            setError("Payment was cancelled. You can try again when ready.");
          },
        },
      });
      checkout.open();
    } catch (err) {
      setPending(false);
      setError(err instanceof Error ? err.message : "Could not start payment. Please try again.");
    }
  }

  return (
    <AuthShell
      wide
      title="Register hospital"
      subtitle="A unique hospital code is assigned automatically. Sign in later with the super admin mobile. Your form draft is kept if you refresh."
    >
      <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">
          Hospital name
          <input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Hospital code
          <input className={`${fieldClass} bg-slate-50`} value={code} readOnly required />
          <span className="mt-1 block text-xs font-normal text-slate-500">
            Assigned uniquely from the hospital name.
          </span>
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
            autoComplete="tel"
            maxLength={13}
            value={phone}
            onChange={(event) => setPhone(event.target.value.replace(/[^\d+]/g, ""))}
            placeholder="10-digit mobile"
            required
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Super admin username
          <input
            className={fieldClass}
            value={adminUsername}
            onChange={(event) => setAdminUsername(event.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Super admin mobile
          <input
            className={fieldClass}
            inputMode="numeric"
            autoComplete="tel"
            maxLength={13}
            value={adminMobile}
            onChange={(event) => setAdminMobile(event.target.value.replace(/[^\d+]/g, ""))}
            placeholder="10-digit mobile — used to sign in"
            required
          />
        </label>
        <label className="sm:col-span-2 text-sm font-medium text-slate-700">
          Super admin password
          <input
            className={fieldClass}
            type="password"
            value={adminPassword}
            onChange={(event) => setAdminPassword(event.target.value)}
            autoComplete="new-password"
            required
          />
        </label>

        <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h2 className="font-semibold text-slate-800">Monthly subscription plan</h2>
          <p className="mt-1 text-sm text-slate-600">
            Choose one fixed plan. Seat counts are suggestions — you can assign any mix of doctors, nurses,
            receptionists, or other staff roles within the plan limit. Super admin is free and does not use a seat.
            Amount is auto-debited every month until you cancel.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {(pkg?.tiers ?? []).map((tier) => {
              const selected = tierId === tier.id;
              return (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => setTierId(tier.id)}
                  className={`rounded-xl border p-4 text-left transition ${
                    selected
                      ? "border-teal-600 bg-white ring-2 ring-teal-600/30"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">{tier.name}</p>
                      <p className="text-xs text-slate-500">{tier.tagline}</p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-teal-800">{inr(tier.monthlyFee)}/mo</p>
                  </div>
                  <p className="mt-2 text-xs text-slate-600">{tier.roleSuggestion}</p>
                  <ul className="mt-2 space-y-1 text-xs text-slate-600">
                    {tier.features.map((feature) => (
                      <li key={feature}>· {feature}</li>
                    ))}
                  </ul>
                </button>
              );
            })}
          </div>
          {quote && selectedTier ? (
            <ul className="mt-4 space-y-1 border-t border-slate-200 pt-3 text-sm">
              {quote.lines.map((line) => (
                <li key={line.description} className="flex justify-between gap-3">
                  <span className="text-slate-700">{line.description}</span>
                  <span className="font-medium">{inr(line.amount)}</span>
                </li>
              ))}
              <li className="flex justify-between gap-3 border-t border-slate-200 pt-2 font-semibold">
                <span>Monthly total (auto-debit)</span>
                <span>{inr(quote.total)}</span>
              </li>
            </ul>
          ) : null}
          <p className="mt-3 text-xs text-slate-600">
            After registration you can upgrade to a higher plan from Subscription; the new amount applies from the next
            billing cycle.
          </p>
        </div>

        <label className="sm:col-span-2 flex items-start gap-2 text-sm text-slate-700">
          <input
            className="mt-1"
            type="checkbox"
            checked={termsAccepted}
            onChange={(event) => setTermsAccepted(event.target.checked)}
            required
          />
          <span>
            I agree to the{" "}
            <Link href="/terms" target="_blank" className="font-medium text-teal-700 underline">
              Terms &amp; Conditions
            </Link>{" "}
            and authorise monthly auto-debit of the package amount until I cancel.
          </span>
        </label>

        {notice ? <p className="sm:col-span-2 text-sm text-amber-800">{notice}</p> : null}
        {error ? <p className="sm:col-span-2 text-sm text-red-600">{error}</p> : null}
        <div className="sm:col-span-2">
          <button
            className={buttonClass}
            type="submit"
            disabled={pending || !termsAccepted || (pkg != null && !pkg.razorpayEnabled)}
          >
            {pending
              ? "Opening payment…"
              : quote
                ? `Pay ${inr(quote.total)} and register`
                : "Pay and register"}
          </button>
        </div>
      </form>
      <p className="mt-4 text-center text-sm text-slate-500">
        Already registered?{" "}
        <Link className="font-medium text-teal-700 hover:underline" href="/login">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
