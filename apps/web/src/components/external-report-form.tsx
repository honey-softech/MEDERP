"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { compactButtonClass } from "@/components/auth-shell";

export function ExternalReportForm({
  orderId,
  reportFileName,
  locked = false,
}: {
  orderId: string;
  reportFileName?: string | null;
  locked?: boolean;
}) {
  const router = useRouter();
  const [fileName, setFileName] = useState(reportFileName ?? "");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function upload(file: File) {
    setError("");
    setPending(true);
    const form = new FormData();
    form.set("file", file);
    const response = await fetch(`/api/lab/orders/${orderId}/report`, { method: "POST", body: form });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not attach the report.");
      return;
    }
    setFileName(data.order?.reportFileName ?? file.name);
    router.refresh();
  }

  return (
    <div className="mt-1.5">
      <label
        className={`inline-flex cursor-pointer items-center gap-2 ${
          locked || pending ? "pointer-events-none opacity-60" : ""
        }`}
      >
        <span className={compactButtonClass}>{pending ? "Uploading…" : fileName ? "Replace" : "Attach report"}</span>
        {fileName ? <span className="truncate text-[11px] text-text-secondary">{fileName}</span> : null}
        <input
          className="sr-only"
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          disabled={locked || pending}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
            event.target.value = "";
          }}
        />
      </label>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
