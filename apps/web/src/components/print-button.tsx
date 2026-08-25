"use client";

import { primaryButtonClass, secondaryButtonClass } from "@/components/auth-shell";

export function PrintButton({
  label = "Print receipt",
  variant = "secondary",
}: {
  label?: string;
  variant?: "primary" | "secondary";
}) {
  return (
    <button
      type="button"
      className={variant === "primary" ? primaryButtonClass : secondaryButtonClass}
      onClick={() => window.print()}
    >
      {label}
    </button>
  );
}
