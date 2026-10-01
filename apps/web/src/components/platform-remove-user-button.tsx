"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PlatformRemoveUserButton({
  userId,
  label,
  redirectTo,
  className = "text-sm font-medium text-red-600 hover:underline disabled:opacity-50",
}: {
  userId: string;
  label: string;
  redirectTo?: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function onRemove() {
    if (
      !window.confirm(
        `Remove account "${label}" from MedERP?\n\nThey will be signed out and this mobile can sign up again. This cannot be undone from the app.`,
      )
    ) {
      return;
    }
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/platform/users/${userId}`, { method: "DELETE" });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Could not remove account.");
        return;
      }
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button type="button" className={className} disabled={pending} onClick={() => void onRemove()}>
        {pending ? "Removing…" : "Remove"}
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </span>
  );
}
