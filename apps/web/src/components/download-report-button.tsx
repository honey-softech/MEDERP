"use client";

import { useState } from "react";
import { secondaryButtonClass } from "@/components/auth-shell";
import { isMedErpMobileApp } from "@/lib/drug-catalog-cache/platform";

const SHARE_TYPES = ["text/csv", "text/plain", "text/comma-separated-values"];

function isIosBrowser() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent);
}

/**
 * iOS opens a CSV link inside the WebView and the installed app has no back
 * control on that screen. Those devices must use the share sheet instead.
 */
function mustShareInPlace() {
  return isMedErpMobileApp() || isIosBrowser();
}

async function shareCsv(blob: Blob, filename: string) {
  if (typeof navigator.share !== "function") return false;
  for (const type of SHARE_TYPES) {
    const file = new File([blob], filename, { type });
    if (typeof navigator.canShare === "function" && !navigator.canShare({ files: [file] })) continue;
    try {
      await navigator.share({ files: [file] });
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
    }
  }
  return false;
}

function saveWithDownloadAttribute(blob: Blob, filename: string) {
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

export function DownloadReportButton({
  href,
  filename,
  label,
}: {
  href: string;
  filename: string;
  label: string;
}) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onDownload() {
    setError("");
    setPending(true);
    try {
      const response = await fetch(href, { credentials: "same-origin" });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || "Could not download the report.");
      }
      const blob = await response.blob();
      const shared = await shareCsv(blob, filename);
      if (shared) return;
      if (mustShareInPlace()) {
        throw new Error("Could not open the share sheet. Stay on this page and try again.");
      }
      saveWithDownloadAttribute(blob, filename);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Could not download the report.");
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="inline-flex flex-col">
      <button type="button" className={secondaryButtonClass} onClick={() => void onDownload()} disabled={pending}>
        {pending ? "Downloading…" : label}
      </button>
      {error ? <span className="mt-1 max-w-xs text-sm text-red-700">{error}</span> : null}
    </span>
  );
}
