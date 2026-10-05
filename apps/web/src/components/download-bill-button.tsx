"use client";

import { useState } from "react";
import { secondaryButtonClass } from "@/components/auth-shell";
import { isMedErpMobileApp } from "@/lib/drug-catalog-cache/platform";

type NativeBridge = { postMessage: (message: string) => void };

function nativeBridge(): NativeBridge | null {
  if (typeof window === "undefined") return null;
  return (window as Window & { MedErpNative?: NativeBridge }).MedErpNative ?? null;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function saveInApp(href: string, filename: string) {
  const bridge = nativeBridge();
  if (!bridge) throw new Error("MedERP app bridge is missing.");
  const response = await fetch(href, { credentials: "same-origin" });
  if (!response.ok) throw new Error("Bill download failed.");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length === 0) throw new Error("Empty bill.");
  bridge.postMessage(JSON.stringify({ type: "download", filename, base64: bytesToBase64(bytes) }));
}

export function DownloadBillButton({ invoiceId, filename }: { invoiceId: string; filename: string }) {
  const [error, setError] = useState("");
  const href = `/api/invoices/${invoiceId}/pdf`;

  return (
    <span className="inline-flex flex-col">
      <a
        href={href}
        className={secondaryButtonClass}
        onClick={(event) => {
          if (!isMedErpMobileApp()) return;
          event.preventDefault();
          setError("");
          void saveInApp(href, filename).catch(() => setError("Could not download the bill."));
        }}
      >
        Download bill
      </a>
      {error ? <span className="mt-1 text-sm text-red-700">{error}</span> : null}
    </span>
  );
}
