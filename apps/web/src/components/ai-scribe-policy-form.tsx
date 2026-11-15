"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClass } from "@/components/auth-shell";

export function AiScribePolicyForm({ initial }: { initial: { aiScribeEnabled: boolean } }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial.aiScribeEnabled);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSaved(false);
    setPending(true);
    const response = await fetch("/api/hospital/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aiScribeEnabled: enabled }),
    });
    const data = await response.json().catch(() => ({ error: "Could not save AI scribe." }));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not save AI scribe.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 grid max-w-5xl gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div>
        <h3 className="font-semibold">AI consult scribe</h3>
        <p className="mt-1 text-sm text-slate-500">
          Off by default. Turn this on to let doctors record a consultation after the patient agrees. The audio is sent
          to OpenAI to make a transcript and a draft note, then discarded. The doctor reviews the draft and nothing is
          sent to the pharmacy until they approve.
        </p>
      </div>

      <label className="flex items-start gap-3 text-sm text-slate-700">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
        />
        <span>
          Allow doctors to record consultations
          <span className="mt-0.5 block text-slate-500">
            Patient health information in the recording is processed by OpenAI. Turn this on only if the hospital
            accepts that.
          </span>
        </span>
      </label>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {saved ? <p className="text-sm text-teal-700">AI scribe saved.</p> : null}
      <div>
        <button className={buttonClass} type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save AI scribe"}
        </button>
      </div>
    </form>
  );
}
