"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { compactButtonClass } from "@/components/auth-shell";

export function ExternalReportForm({
  orderId,
  reportFileName,
  locked = false,
  label,
}: {
  orderId: string;
  reportFileName?: string | null;
  locked?: boolean;
  label?: string;
}) {
  const router = useRouter();
  const [fileName, setFileName] = useState(reportFileName ?? "");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const idleLabel = label ?? (fileName ? "Replace" : "Attach report");

  async function upload(files: FileList | File[]) {
    const list = Array.from(files).filter((file) => file.size > 0);
    if (list.length === 0) return;
    setError("");
    setPending(true);
    const form = new FormData();
    for (const file of list) form.append("files", file);
    const response = await fetch(`/api/lab/orders/${orderId}/report`, { method: "POST", body: form });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not attach the report.");
      return;
    }
    setFileName(data.order?.reportFileName ?? (list.length > 1 ? "lab-report.pdf" : list[0]!.name));
    router.refresh();
  }

  return (
    <div className="mt-1.5">
      <label
        className={`inline-flex cursor-pointer items-center gap-2 ${
          locked || pending ? "pointer-events-none opacity-60" : ""
        }`}
      >
        <span className={compactButtonClass}>{pending ? "Uploading…" : fileName ? "Replace report" : idleLabel}</span>
        {fileName ? <span className="truncate text-[11px] text-text-secondary">{fileName}</span> : null}
        <input
          className="sr-only"
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          multiple
          disabled={locked || pending}
          onChange={(event) => {
            const files = event.target.files;
            if (files?.length) void upload(files);
            event.target.value = "";
          }}
        />
      </label>
      <p className="mt-1 text-[10px] text-text-secondary">
        Select multiple page images or PDFs — they are combined into one report.
      </p>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
