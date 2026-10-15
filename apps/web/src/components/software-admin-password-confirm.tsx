"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { fieldClass, secondaryButtonClass } from "@/lib/ui";

const dangerButtonClass =
  "inline-flex h-10 items-center justify-center rounded-lg bg-critical px-4 text-sm font-medium text-white hover:bg-critical/90 disabled:opacity-60";

export function SoftwareAdminPasswordConfirm({
  openLabel,
  confirmLabel,
  description,
  pendingLabel = "Removing…",
  onConfirm,
}: {
  openLabel: string;
  confirmLabel: string;
  description: string;
  pendingLabel?: string;
  onConfirm: (password: string) => Promise<{ ok: boolean; error?: string; redirectTo?: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const result = await onConfirm(password);
      if (!result.ok) {
        setError(result.error ?? "Could not confirm.");
        return;
      }
      setPassword("");
      setOpen(false);
      if (result.redirectTo) router.push(result.redirectTo);
      else router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <span className="inline-flex flex-col items-start gap-1">
        <button type="button" className={dangerButtonClass} onClick={() => setOpen(true)}>
          {openLabel}
        </button>
        {error ? <span className="text-xs text-red-600">{error}</span> : null}
      </span>
    );
  }

  return (
    <form onSubmit={submit} className="grid max-w-sm gap-2">
      <p className="text-sm text-slate-600">{description}</p>
      <label className="text-sm font-medium text-slate-700">
        Your software admin password
        <input
          className={fieldClass}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </label>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button className={dangerButtonClass} type="submit" disabled={pending || !password}>
          {pending ? pendingLabel : confirmLabel}
        </button>
        <button
          className={secondaryButtonClass}
          type="button"
          disabled={pending}
          onClick={() => {
            setPassword("");
            setError("");
            setOpen(false);
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
