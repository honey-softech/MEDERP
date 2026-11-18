"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

function stable(value: unknown) {
  return JSON.stringify(value);
}

export function useSettingsForm<T>(initial: T) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [baseline, setBaseline] = useState(initial);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  const dirty = useMemo(() => stable(values) !== stable(baseline), [values, baseline]);

  function update(next: T | ((current: T) => T)) {
    setSaved(false);
    setValues(next);
  }

  function patch(partial: Partial<T>) {
    update((current) => ({ ...current, ...partial }));
  }

  function discard() {
    setValues(baseline);
    setError("");
    setSaved(false);
  }

  async function save(body: Record<string, unknown>, fallbackError: string) {
    if (Object.keys(body).length === 0) return false;
    const snapshot = values;
    setError("");
    setSaved(false);
    setPending(true);
    try {
      const response = await fetch("/api/hospital/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json().catch(() => ({ error: fallbackError }))) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? fallbackError);
        return false;
      }
      setBaseline(snapshot);
      setSaved(true);
      router.refresh();
      return true;
    } catch {
      setError(fallbackError);
      return false;
    } finally {
      setPending(false);
    }
  }

  return { values, baseline, dirty, error, saved, pending, update, patch, discard, save };
}
