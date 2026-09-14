"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AuthShell, buttonClass, fieldClass, textareaClass } from "@/components/auth-shell";
import { mobileValidationError } from "@/lib/phone";
import {
  SUBSCRIPTION_GST_PERCENT,
  subscriptionGstAmount,
  subscriptionTotalWithGst,
} from "@/lib/platform-pricing";
import {
  clearRegisterHospitalDraft,
  loadRegisterHospitalDraft,
  saveRegisterHospitalDraft,
  type RegisterDoctorDraft,
} from "@/lib/register-hospital-draft";
import { DoctorProfessionalFields } from "@/components/doctor-professional-fields";
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
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [tierId, setTierId] = useState("CLINIC");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [adminAsDoctor, setAdminAsDoctor] = useState(false);
  const [doctorProfile, setDoctorProfile] = useState<RegisterDoctorDraft>({
    firstName: "",
    lastName: "",
    medicalRegNo: "",
    specialization: "",
    medicalDegree: "",
    regCouncil: "",
    postgraduate: "",
    consultationFee: "",
    followUpFee: "",
    teleconsultEnabled: false,
    emergencyDutyEnabled: false,
  });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const skipCodeFetch = useRef(true);
  const lastFetchedName = useRef("");
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
      setAdminEmail(draft.adminEmail || "");
      setTierId(draft.tierId || "CLINIC");
      setTermsAccepted(draft.termsAccepted);
      setAdminAsDoctor(Boolean(draft.adminAsDoctor));
      if (draft.doctorProfile) setDoctorProfile(draft.doctorProfile);
      skipCodeFetch.current = /^[A-Z0-9]{8}$/i.test(draft.code || "");
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
      adminEmail,
      tierId,
      termsAccepted,
      adminAsDoctor,
      doctorProfile,
    });
  }, [
    draftReady,
    name,
    code,
    address,
    phone,
    adminUsername,
    adminMobile,
    adminEmail,
    tierId,
    termsAccepted,
    adminAsDoctor,
    doctorProfile,
  ]);

  async function assignHospitalCode(hospitalName: string, keep?: string) {
    if (hospitalName.trim().length < 2) return;
    const query = new URLSearchParams({ name: hospitalName.trim() });
    if (keep) query.set("code", keep);
    const response = await fetch(`/api/public/hospital-code?${query.toString()}`);
    const data = await response.json().catch(() => ({}));
    if (data.code) setCode(String(data.code));
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
    const subtotal = selectedTier.monthlyFee;
    const gstAmount = subscriptionGstAmount(subtotal);
    return {
      lines: [
        { description: `${selectedTier.name} plan`, amount: subtotal },
        { description: `GST (${SUBSCRIPTION_GST_PERCENT}%)`, amount: gstAmount },
      ],
      total: subscriptionTotalWithGst(subtotal),
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
      adminEmail,
      adminPassword,
      tierId,
      termsAccepted,
      adminAsDoctor,
      doctorProfile: adminAsDoctor ? doctorProfile : null,
    }),
    [
      name,
      code,
      address,
      phone,
      adminUsername,
      adminMobile,
      adminEmail,
      adminPassword,
      tierId,
      termsAccepted,
      adminAsDoctor,
      doctorProfile,
    ],
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

  function validateForm() {
    if (!termsAccepted) {
      setError("Accept the Terms & Conditions to continue.");
      return false;
    }
    const hospitalMobileError = mobileValidationError(phone, "Hospital mobile");
    if (hospitalMobileError) {
      setError(hospitalMobileError);
      return false;
    }
    const adminMobileError = mobileValidationError(adminMobile, "Super admin mobile");
    if (adminMobileError) {
      setError(adminMobileError);
      return false;
    }
    const email = adminEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid super admin email for payment receipts.");
      return false;
    }
    if (!adminPassword || adminPassword.length < 8) {
      setError("Super admin password must be at least 8 characters.");
      return false;
    }
    if (adminAsDoctor) {
      if (!doctorProfile.specialization.trim()) {
        setError("Enter specialization for the admin doctor profile.");
        return false;
      }
      if (!doctorProfile.medicalRegNo.trim()) {
        setError("Enter medical registration number for the admin doctor profile.");
        return false;
      }
    }
    return true;
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!validateForm()) return;
    setPending(true);

    try {
      if (pkg != null && !pkg.razorpayEnabled) {
        setError(
          "Online payment is not configured on the server. Add RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, and NEXT_PUBLIC_RAZORPAY_KEY_ID to apps/web/.env, then restart/redeploy.",
        );
        setPending(false);
        return;
      }
      if (pkg == null) {
        setError("Could not load billing package. Refresh the page and try Pay again.");
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
            ? `Card setup · first charge after 1-month trial — ${String(orderData.hospitalName || name)}`
            : `Hospital registration — ${String(orderData.hospitalName || name)}`,
        prefill: {
          name: String((orderData.prefill as { name?: string } | undefined)?.name || adminUsername),
          contact: String((orderData.prefill as { contact?: string } | undefined)?.contact || adminMobile),
          email: String((orderData.prefill as { email?: string } | undefined)?.email || adminEmail),
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
      <form onSubmit={onSubmit} className="space-y-6">
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_26rem]">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Hospital name
              <input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} required />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Hospital code
              <input className={`${fieldClass} bg-slate-50`} value={code} readOnly required />
              <span className="mt-1 block text-xs font-normal text-slate-500">
                8-letter code from the hospital name.
              </span>
            </label>
            <label className="sm:col-span-2 text-sm font-medium text-slate-700">
              Address
              <textarea
                className={`${textareaClass} resize-none`}
                rows={2}
                value={address}
                onChange={(event) => setAddress(event.target.value)}
              />
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
              Super admin name
              <input
                className={fieldClass}
                value={adminUsername}
                onChange={(event) => setAdminUsername(event.target.value)}
                autoComplete="name"
                placeholder="Any name — login uses mobile, not username"
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
            <label className="text-sm font-medium text-slate-700">
              Super admin email
              <input
                className={fieldClass}
                type="email"
                autoComplete="email"
                value={adminEmail}
                onChange={(event) => setAdminEmail(event.target.value)}
                required
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
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

            <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-white p-4">
              <label className="flex items-start gap-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={adminAsDoctor}
                  onChange={(event) => setAdminAsDoctor(event.target.checked)}
                />
                <span>
                  <span className="font-medium">Admin is also a doctor</span>
                  <span className="mt-0.5 block text-slate-500">
                    Same mobile and login for hospital admin and clinical practice. Fill doctor details
                    below — enabled automatically after registration.
                  </span>
                </span>
              </label>

              {adminAsDoctor ? (
                <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 md:grid-cols-2">
                  <label className="text-sm font-medium text-slate-700">
                    Doctor first name
                    <input
                      className={fieldClass}
                      value={doctorProfile.firstName}
                      onChange={(e) => setDoctorProfile((c) => ({ ...c, firstName: e.target.value }))}
                      placeholder="Defaults to admin name if blank"
                    />
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    Doctor last name
                    <input
                      className={fieldClass}
                      value={doctorProfile.lastName}
                      onChange={(e) => setDoctorProfile((c) => ({ ...c, lastName: e.target.value }))}
                    />
                  </label>
                  <DoctorProfessionalFields
                    values={doctorProfile}
                    onChange={(key, value) =>
                      setDoctorProfile((current) => ({ ...current, [key]: value }))
                    }
                    requireCore
                  />
                </div>
              ) : null}
            </div>
          </div>

          <aside className="rounded-xl border border-slate-200 bg-slate-50 p-4 lg:sticky lg:top-6">
            <h2 className="font-semibold text-slate-800">Monthly subscription plan</h2>
            <p className="mt-1 text-sm text-slate-600">
              Add your card now to start. You get 1 month free; the plan amount is debited automatically from next
              month. Super admin is free and does not use a seat.
            </p>
            <div className="mt-3 grid gap-2">
              {(pkg?.tiers ?? []).map((tier) => {
                const selected = tierId === tier.id;
                return (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => setTierId(tier.id)}
                    className={`rounded-lg border p-3 text-left transition ${
                      selected
                        ? "border-teal-600 bg-white ring-2 ring-teal-600/20"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{tier.name}</p>
                        <p className="text-xs text-slate-500">{tier.tagline}</p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold text-teal-800">
                        {inr(tier.monthlyFee)}
                        <span className="font-normal text-slate-500"> +GST</span>
                        <span className="block text-right text-[10px] font-normal text-slate-500">/mo</span>
                      </p>
                    </div>
                    {selected ? (
                      <>
                        <p className="mt-2 text-xs text-slate-600">{tier.roleSuggestion}</p>
                        <ul className="mt-1.5 space-y-0.5 text-xs text-slate-600">
                          {tier.features.map((feature) => (
                            <li key={feature}>· {feature}</li>
                          ))}
                        </ul>
                      </>
                    ) : (
                      <p className="mt-1 text-xs text-slate-500">{tier.roleSuggestion}</p>
                    )}
                  </button>
                );
              })}
            </div>
            {quote && selectedTier ? (
              <ul className="mt-3 space-y-1 border-t border-slate-200 pt-3 text-sm">
                {quote.lines.map((line) => (
                  <li key={line.description} className="flex justify-between gap-3">
                    <span className="text-slate-700">{line.description}</span>
                    <span className="font-medium">{inr(line.amount)}</span>
                  </li>
                ))}
                <li className="flex justify-between gap-3 border-t border-slate-200 pt-2 font-semibold">
                  <span>Monthly total (incl. GST)</span>
                  <span>{inr(quote.total)}</span>
                </li>
              </ul>
            ) : null}
            <p className="mt-3 text-xs text-slate-600">
              You can upgrade later from Subscription; the new amount applies from the next billing cycle.
            </p>
          </aside>
        </div>

        <label className="flex items-start gap-2 text-sm text-slate-700">
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
            </Link>
            . Add a card to start the 1-month trial. The selected plan is charged automatically from next month.
          </span>
        </label>

        {notice ? <p className="text-sm text-amber-800">{notice}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            className={`${buttonClass} sm:w-auto sm:min-w-56`}
            type="submit"
            disabled={pending || !termsAccepted || (pkg != null && !pkg.razorpayEnabled)}
          >
            {pending
              ? "Opening Razorpay…"
              : quote
                ? `Add card · ${inr(quote.total)}/mo from next month`
                : "Add card · charge from next month"}
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Razorpay will ask for card details to authorise auto-debit. Monthly total includes {SUBSCRIPTION_GST_PERCENT}%
          GST. The plan is not charged today — first debit is after the free trial month.
        </p>
        {pkg != null && !pkg.razorpayEnabled ? (
          <p className="text-sm text-amber-800">
            Razorpay keys are missing on this server, so card setup is disabled. Add keys and restart.
          </p>
        ) : null}
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
