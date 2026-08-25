"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { secondaryButtonClass } from "@/components/auth-shell";

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
    <div className="mt-3">
      <p className="text-sm font-medium text-slate-700">Attach report brought by the patient</p>
      <label
        className={`mt-2 flex cursor-pointer flex-col items-start gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 ${
          locked || pending ? "pointer-events-none opacity-60" : "hover:border-teal-600 hover:bg-teal-50"
        }`}
      >
        <span className={secondaryButtonClass}>{pending ? "Uploading…" : fileName ? "Replace file" : "Choose PDF or image"}</span>
        <span className="text-sm text-slate-600">
          {fileName || "PDF, JPG, or PNG up to 8 MB. After this is attached, the doctor can update the assessment and visit summary."}
        </span>
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
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
