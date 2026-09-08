"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { secondaryButtonClass } from "@/components/auth-shell";

export function VoidCertificateButton({ certificateId }: { certificateId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function onVoid() {
    const reason = window.prompt("Reason for voiding this certificate? (optional)");
    if (reason === null) return;
    setPending(true);
    setError("");
    const response = await fetch(`/api/certificates/${certificateId}/void`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason.trim() }),
    });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not void the certificate.");
      return;
    }
    router.refresh();
  }

  return (
    <span className="inline-flex flex-col items-start">
      <button type="button" className={secondaryButtonClass} disabled={pending} onClick={() => void onVoid()}>
        {pending ? "Voiding…" : "Void certificate"}
      </button>
      {error ? <span className="mt-1 text-[11px] text-red-600">{error}</span> : null}
    </span>
  );
}
