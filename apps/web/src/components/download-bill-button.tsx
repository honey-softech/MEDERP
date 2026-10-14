"use client";

import { useState } from "react";
import { secondaryButtonClass } from "@/components/auth-shell";

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

async function billBytes(href: string) {
  const response = await fetch(href, { credentials: "same-origin" });
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error || "Could not download the bill.");
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length < 5 || String.fromCharCode(...bytes.subarray(0, 4)) !== "%PDF") {
    throw new Error("The bill file could not be read.");
  }
  return bytes;
}

function saveInBrowser(bytes: Uint8Array, filename: string) {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  const blob = new Blob([copy], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function DownloadBillButton({ invoiceId, filename }: { invoiceId: string; filename: string }) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const href = `/api/invoices/${invoiceId}/pdf`;

  async function onDownload() {
    setError("");
    setPending(true);
    try {
      const bytes = await billBytes(href);
      const bridge = nativeBridge();
      if (bridge) {
        bridge.postMessage(JSON.stringify({ type: "download", filename, base64: bytesToBase64(bytes) }));
        return;
      }
      saveInBrowser(bytes, filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not download the bill.");
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="inline-flex flex-col">
      <button type="button" className={secondaryButtonClass} onClick={() => void onDownload()} disabled={pending}>
        {pending ? "Downloading…" : "Download bill"}
      </button>
      {error ? <span className="mt-1 text-sm text-red-700">{error}</span> : null}
    </span>
  );
}
