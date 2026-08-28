"use client";

import { useEffect, useState } from "react";
import { primaryButtonClass } from "@/components/auth-shell";

type Job = {
  running: boolean;
  message: string;
  inserted: number;
  skipped: number;
  error: string | null;
};

export function LoadDrugCatalog({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount);
  const [job, setJob] = useState<Job | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!job?.running) return;
    const timer = window.setInterval(() => {
      void fetch("/api/hospital/drug-catalog")
        .then(async (response) => {
          const data = (await response.json()) as { catalogSize?: number; job?: Job | null };
          if (typeof data.catalogSize === "number") setCount(data.catalogSize);
          if (data.job) setJob(data.job);
        })
        .catch(() => undefined);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [job?.running]);

  async function load() {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/hospital/drug-catalog", { method: "POST" });
      const data = (await response.json()) as { error?: string; alreadyLoaded?: boolean; catalogSize?: number; job?: Job };
      if (!response.ok) {
        setError(data.error || "Could not start import.");
        return;
      }
      if (typeof data.catalogSize === "number") setCount(data.catalogSize);
      if (data.job) setJob(data.job);
      else setJob({ running: true, message: "Downloading medicine list…", inserted: 0, skipped: 0, error: null });
    } catch {
      setError("Could not start import.");
    } finally {
      setPending(false);
    }
  }

  if (count > 0 && !job?.running) {
    return (
      <p className="mb-4 text-sm text-text-secondary">
        Medicine catalog: <span className="font-medium text-text-primary">{count.toLocaleString("en-IN")}</span> drugs.
      </p>
    );
  }

  return (
    <div className="mb-6 rounded-lg border border-warning/40 bg-warning-bg px-3 py-3">
      <p className="text-sm font-medium text-text-primary">Medicine catalog is empty on this server</p>
      <p className="mt-1 text-xs text-text-secondary">
        Prescription search needs this list. Load it once — it takes a few minutes.
      </p>
      {job?.message ? <p className="mt-2 text-xs text-text-secondary">{job.message}</p> : null}
      {error ? <p className="mt-2 text-xs text-critical">{error}</p> : null}
      <button
        type="button"
        className={`${primaryButtonClass} mt-3`}
        disabled={pending || Boolean(job?.running)}
        onClick={() => void load()}
      >
        {job?.running ? "Loading medicines…" : pending ? "Starting…" : "Load medicine catalog"}
      </button>
    </div>
  );
}
