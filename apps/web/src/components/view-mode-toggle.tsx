"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { ViewMode } from "@/lib/view-mode";

const ADMIN_ONLY_PREFIXES = ["/hospital/", "/drug-brands"];

export function ViewModeToggle({ mode }: { mode: ViewMode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, setPending] = useState(false);

  async function switchMode(next: ViewMode) {
    if (next === mode || pending) return;
    setPending(true);
    try {
      const response = await fetch("/api/session/view-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: next }),
      });
      if (!response.ok) {
        setPending(false);
        return;
      }
      if (next === "doctor" && ADMIN_ONLY_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
        router.push("/");
      } else {
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className="inline-flex shrink-0 rounded-lg border border-border bg-surface p-0.5 text-xs font-medium"
      role="group"
      aria-label="View mode"
    >
      <button
        type="button"
        disabled={pending}
        onClick={() => void switchMode("doctor")}
        className={`rounded-md px-2.5 py-1.5 transition ${
          mode === "doctor"
            ? "bg-teal-700 text-white shadow-sm"
            : "text-text-secondary hover:text-text-primary"
        }`}
      >
        Doctor
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => void switchMode("admin")}
        className={`rounded-md px-2.5 py-1.5 transition ${
          mode === "admin"
            ? "bg-teal-700 text-white shadow-sm"
            : "text-text-secondary hover:text-text-primary"
        }`}
      >
        Admin
      </button>
    </div>
  );
}
