"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { buttonClass, secondaryButtonClass } from "@/components/auth-shell";
import { ExtraUsersField } from "@/components/extra-users-field";
import { loadRazorpayCheckoutScript } from "@/lib/razorpay-checkout";
import { SUBSCRIPTION_GST_PERCENT, pricingFromTier } from "@/lib/platform-pricing";

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
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function HospitalSeatSubscriptionForm({
  currentUsed,
  currentLimit,
  currentExtraUsers,
  currentMonthly,
  currentTierId,
  currentTierName,
  tiers,
  hasSubscription,
  pendingSubscriptionTier,
  pendingExtraUsers,
  pendingMonthlyAmount,
  nextChargeAt,
  cancelAtPeriodEnd,
  subscriptionStatus,
  razorpayEnabled,
}: {
  currentUsed: number;
  currentLimit: number | null;
  currentExtraUsers: number;
  currentMonthly: number;
  currentTierId: string;
  currentTierName: string;
  tiers: TierInfo[];
  hasSubscription: boolean;
  pendingSubscriptionTier: string | null;
  pendingExtraUsers: number | null;
  pendingMonthlyAmount: number | null;
  nextChargeAt: string | null;
  cancelAtPeriodEnd: boolean;
  subscriptionStatus: string | null;
  razorpayEnabled: boolean;
}) {
  const router = useRouter();
  const baselineTier = pendingSubscriptionTier || currentTierId;
  const baselineExtra = pendingExtraUsers ?? currentExtraUsers;
  const [tierId, setTierId] = useState(baselineTier);
  const [extraUsers, setExtraUsers] = useState(baselineExtra);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const selected = useMemo(() => tiers.find((tier) => tier.id === tierId) ?? null, [tiers, tierId]);
  const minimumExtra = selected?.seatLimit == null ? 0 : Math.max(0, currentUsed - selected.seatLimit);
  useEffect(() => {
    if (!selected) return;
    if (selected.seatLimit == null) {
      if (extraUsers !== 0) setExtraUsers(0);
      return;
    }
    if (extraUsers < minimumExtra) setExtraUsers(minimumExtra);
  }, [extraUsers, minimumExtra, selected]);
  const preview = useMemo(() => {
    if (!selected) return null;
    try {
      return pricingFromTier(selected.id, extraUsers);
    } catch {
      return null;
    }
  }, [selected, extraUsers]);
  const previewMonthly = preview?.total ?? currentMonthly;
  const hasChanges = Boolean(selected && (selected.id !== baselineTier || extraUsers !== baselineExtra));
  const extraNote = !hasSubscription
    ? extraUsers > 0
      ? "These seats are included when auto-debit is linked."
      : undefined
    : extraUsers > currentExtraUsers
      ? "Added seats are available as soon as you save. The higher amount is charged from the next billing cycle."
      : extraUsers < currentExtraUsers
        ? "Removed seats stay until the end of this billing cycle."
        : undefined;

  async function onSchedule(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    setMessage("");
    if (!termsAccepted) {
      setPending(false);
      setError("Accept the Terms & Conditions before updating the subscription.");
      return;
    }
    if (!hasChanges) {
      setPending(false);
      setError("Select a different plan to upgrade or change.");
      return;
    }
    const response = await fetch("/api/hospital/subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "schedule",
        tierId,
        extraUsers,
        termsAccepted,
      }),
    });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not update subscription.");
      return;
    }
    const nextAmount = inr(Number(data.nextMonthly ?? previewMonthly));
    setMessage(
      data.seatsAvailableNow
        ? `Extra users are available now. New monthly auto-debit from the next cycle: ${nextAmount}.`
        : `Scheduled for next billing cycle. New monthly auto-debit: ${nextAmount}.`,
    );
    router.refresh();
  }

  async function onCancel() {
    if (!window.confirm("Cancel auto-debit at the end of the current billing cycle?")) return;
    setPending(true);
    setError("");
    setMessage("");
    const response = await fetch("/api/hospital/subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel", atCycleEnd: true }),
    });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not cancel subscription.");
      return;
    }
    setMessage(
      data.subscription?.cancelAtPeriodEnd
        ? "Cancellation scheduled for the end of the current billing cycle."
        : "Auto-debit is cancelled. No further charge will be taken.",
    );
    router.refresh();
  }

  async function onStartSubscription() {
    setPending(true);
    setError("");
    setMessage("");
    if (!termsAccepted) {
      setPending(false);
      setError("Accept the Terms & Conditions before starting auto-debit.");
      return;
    }
    const packagePayload = { tierId, extraUsers };
    const createResponse = await fetch("/api/hospital/subscription/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phase: "create", termsAccepted: true, ...packagePayload }),
    });
    const createData = await createResponse.json().catch(() => ({}));
    if (!createResponse.ok) {
      setPending(false);
      setError(createData.error ?? "Could not start subscription.");
      return;
    }
    const scriptReady = await loadRazorpayCheckoutScript();
    if (!scriptReady || !window.Razorpay) {
      setPending(false);
      setError("Could not load Razorpay Checkout.");
      return;
    }
    const checkout = new window.Razorpay({
      key: createData.keyId,
      subscription_id: createData.subscriptionId,
      name: "MedERP",
      description: "Monthly auto-debit — linked on payment",
      prefill: {
        name: createData.prefill?.name,
        contact: createData.prefill?.contact,
        email: createData.prefill?.email,
      },
      handler: (response) => {
        void (async () => {
          if (!("razorpay_subscription_id" in response) || !response.razorpay_subscription_id) {
            setPending(false);
            setError("Expected a subscription payment response from Razorpay.");
            return;
          }
          const confirmResponse = await fetch("/api/hospital/subscription/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              phase: "confirm",
              termsAccepted: true,
              planId: createData.planId,
              ...packagePayload,
              razorpay_subscription_id: response.razorpay_subscription_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });
          const confirmData = await confirmResponse.json().catch(() => ({}));
          setPending(false);
          if (!confirmResponse.ok) {
            setError(confirmData.error ?? "Payment succeeded but linking failed.");
            return;
          }
          setMessage("Subscription linked. Monthly auto-debit is active.");
          router.refresh();
        })();
      },
      modal: {
        ondismiss: () => {
          setPending(false);
          setError("Payment cancelled.");
        },
      },
    });
    checkout.open();
  }

  const pendingTierName = tiers.find((tier) => tier.id === pendingSubscriptionTier)?.name;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h3 className="font-semibold">Current plan</h3>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Plan</dt>
            <dd className="font-medium">{currentTierName}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Staff usage</dt>
            <dd className="font-medium">
              {currentUsed}/{currentLimit == null ? "∞" : currentLimit}
              {currentExtraUsers > 0 ? ` · ${currentExtraUsers} extra` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Monthly amount</dt>
            <dd className="font-medium">{inr(currentMonthly)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Auto-debit</dt>
            <dd className="font-medium">{hasSubscription ? subscriptionStatus ?? "Linked" : "Not linked"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Next charge</dt>
            <dd className="font-medium">
              {nextChargeAt
                ? new Date(nextChargeAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
                : "—"}
            </dd>
          </div>
        </dl>
        {!hasSubscription ? (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Razorpay auto-debit is not linked yet. Choose a plan below, accept Terms, then pay once to link monthly
            billing.
          </p>
        ) : null}
        {pendingMonthlyAmount != null ? (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Pending from next cycle: {inr(pendingMonthlyAmount)}
            {pendingTierName ? ` · ${pendingTierName}` : ""}
            {pendingExtraUsers != null && pendingExtraUsers > 0
              ? ` · ${pendingExtraUsers} extra user${pendingExtraUsers === 1 ? "" : "s"}`
              : ""}
          </p>
        ) : null}
        {cancelAtPeriodEnd ? (
          <p className="mt-3 text-sm text-amber-800">Cancellation is scheduled at the end of the current billing cycle.</p>
        ) : null}
      </section>

      <form
        onSubmit={hasSubscription ? onSchedule : (event) => {
          event.preventDefault();
          void onStartSubscription();
        }}
        className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div>
          <h3 className="font-semibold">{hasSubscription ? "Change plan" : "Link auto-debit"}</h3>
          <p className="mt-1 text-sm text-slate-600">
            Fixed plans only. Seats can be any mix of roles.{" "}
            {hasSubscription
              ? "Plan changes apply from the next billing cycle."
              : "Pay once to link Razorpay monthly auto-debit."}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {tiers.map((tier) => {
            const selectedCard = tierId === tier.id;
            const isCurrent = tier.id === currentTierId;
            return (
              <button
                key={tier.id}
                type="button"
                onClick={() => setTierId(tier.id)}
                className={`rounded-xl border p-4 text-left ${
                  selectedCard
                    ? "border-teal-600 bg-teal-50/40 ring-2 ring-teal-600/20"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex justify-between gap-2">
                  <div>
                    <p className="font-semibold">
                      {tier.name}
                      {isCurrent ? <span className="ml-2 text-xs font-normal text-teal-700">Current</span> : null}
                    </p>
                    <p className="text-xs text-slate-500">{tier.tagline}</p>
                  </div>
                  <p className="text-sm font-semibold text-teal-800">
                    {inr(tier.monthlyFee)}
                    <span className="font-normal text-slate-500"> +GST</span>/mo
                  </p>
                </div>
                <p className="mt-2 text-xs text-slate-600">{tier.roleSuggestion}</p>
              </button>
            );
          })}
        </div>
        <ExtraUsersField
          value={extraUsers}
          includedSeats={selected?.seatLimit ?? null}
          min={minimumExtra}
          disabled={pending}
          onChange={setExtraUsers}
          note={extraNote}
        />
        <div className="rounded-xl bg-slate-50 p-3 text-sm">
          <p className="text-slate-500">
            {hasSubscription ? "Next-cycle monthly total" : "Monthly auto-debit amount"} (incl. {SUBSCRIPTION_GST_PERCENT}%
            GST)
          </p>
          <p className="text-lg font-semibold">{inr(previewMonthly)}</p>
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
            </Link>{" "}
            {hasSubscription
              ? "and understand the new amount will auto-debit from the next billing cycle."
              : "and authorise monthly auto-debit of the amount shown for 12 months, unless I cancel earlier."}
          </span>
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {message ? <p className="text-sm text-teal-700">{message}</p> : null}
        <div className="flex flex-wrap gap-2">
          {hasSubscription ? (
            <>
              <button className={buttonClass} type="submit" disabled={pending || !termsAccepted || !hasChanges}>
                {pending ? "Saving…" : "Schedule update"}
              </button>
              {!cancelAtPeriodEnd ? (
                <button className={secondaryButtonClass} type="button" disabled={pending} onClick={() => void onCancel()}>
                  Cancel at period end
                </button>
              ) : null}
            </>
          ) : (
            <button className={buttonClass} type="submit" disabled={pending || !termsAccepted || !razorpayEnabled}>
              {pending ? "Opening payment…" : `Pay & link ${inr(previewMonthly)} / month`}
            </button>
          )}
          <Link href="/hospital/users" className={secondaryButtonClass}>
            Back to users
          </Link>
        </div>
      </form>
    </div>
  );
}
