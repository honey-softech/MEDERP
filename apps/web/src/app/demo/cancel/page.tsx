"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AuthShell, primaryButtonClass, secondaryButtonClass } from "@/components/auth-shell";

function CancelForm() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function cancel() {
    setPending(true);
    setError("");
    const response = await fetch("/api/public/demo/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not cancel.");
      return;
    }
    setDone(true);
  }

  return (
    <AuthShell title="Cancel demo" subtitle={done ? "This demo has been cancelled." : "This frees the slot on our calendar."}>
      {done ? (
        <Link className={secondaryButtonClass} href="/demo">
          Book another time
        </Link>
      ) : (
        <div className="space-y-3">
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button className={primaryButtonClass} type="button" disabled={pending || !token} onClick={() => void cancel()}>
            {pending ? "Cancelling…" : "Cancel this demo"}
          </button>
        </div>
      )}
    </AuthShell>
  );
}

export default function DemoCancelPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-500">Loading…</div>}>
      <CancelForm />
    </Suspense>
  );
}
