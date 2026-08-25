"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { primaryButtonClass, secondaryButtonClass } from "@/components/auth-shell";

type Item = { id: string; nameSnapshot: string };

export function LabWorkForm({
  orderId,
  status,
  items,
  reportFileName,
}: {
  orderId: string;
  status: string;
  items: Item[];
  reportFileName: string | null;
}) {
  const router = useRouter();
  const [fileName, setFileName] = useState(reportFileName);
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");

  async function collectSample() {
    setError("");
    setPending("collect-sample");
    const response = await fetch(`/api/lab/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "collect-sample" }),
    });
    const data = await response.json().catch(() => ({}));
    setPending("");
    if (!response.ok) {
      setError(data.error ?? "Could not mark the sample collected.");
      return;
    }
    router.refresh();
  }

  async function upload(file: File) {
    setError("");
    setPending("upload");
    const form = new FormData();
    form.set("file", file);
    const response = await fetch(`/api/lab/orders/${orderId}/report`, { method: "POST", body: form });
    const data = await response.json().catch(() => ({}));
    setPending("");
    if (!response.ok) {
      setError(data.error ?? "Could not upload the report.");
      return;
    }
    setFileName(data.order?.reportFileName ?? file.name);
    router.refresh();
  }

  async function markDone() {
    setError("");
    setPending("mark-done");
    const response = await fetch(`/api/lab/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark-done" }),
    });
    const data = await response.json().catch(() => ({}));
    setPending("");
    if (!response.ok) {
      setError(data.error ?? "Could not mark this done.");
      return;
    }
    router.refresh();
  }

  const locked = status === "RESULTED";

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div>
        <h4 className="font-semibold">Tests on this request</h4>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
          {items.map((item) => (
            <li key={item.id}>{item.nameSnapshot}</li>
          ))}
        </ul>
      </div>

      {status === "PAID" ? (
        <button className={secondaryButtonClass} type="button" disabled={Boolean(pending)} onClick={() => void collectSample()}>
          {pending === "collect-sample" ? "Saving…" : "Mark sample collected"}
        </button>
      ) : null}

      <div>
        <p className="text-sm font-medium text-slate-700">Lab report document</p>
        <label
          className={`mt-2 flex cursor-pointer flex-col items-start gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 ${
            locked || pending ? "pointer-events-none opacity-60" : "hover:border-teal-600 hover:bg-teal-50"
          }`}
        >
          <span className={secondaryButtonClass}>{pending === "upload" ? "Uploading…" : fileName ? "Replace file" : "Choose file"}</span>
          <span className="text-sm text-slate-600">
            {fileName ?? "PDF, JPG, or PNG up to 8 MB. The doctor and nurse will see it on the patient record after you mark this done."}
          </span>
          <input
            className="sr-only"
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            disabled={locked || Boolean(pending)}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
              event.target.value = "";
            }}
          />
        </label>
        {fileName ? (
          <p className="mt-2 text-sm text-slate-500">
            {locked ? "Marked done for the doctor and nurse." : "Not on the patient record until you mark this done."}
          </p>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {locked ? (
        <p className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-900">
          Done. The doctor has been notified. The report is on the patient record.
        </p>
      ) : (
        <button className={primaryButtonClass} type="button" disabled={!fileName || Boolean(pending)} onClick={() => void markDone()}>
          {pending === "mark-done" ? "Saving…" : "Mark as done"}
        </button>
      )}
    </div>
  );
}
