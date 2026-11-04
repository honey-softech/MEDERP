"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClass, fieldClass } from "@/components/auth-shell";
import { WHATSAPP_LANGUAGES } from "@/lib/messaging/whatsapp-language";

export function WhatsAppLanguageForm({ initial }: { initial: { whatsappLanguage: string } }) {
  const router = useRouter();
  const [language, setLanguage] = useState(initial.whatsappLanguage || "en");
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
      body: JSON.stringify({ whatsappLanguage: language }),
    });
    const data = await response.json().catch(() => ({ error: "Could not save WhatsApp language." }));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not save WhatsApp language.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 grid max-w-5xl gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div>
        <h3 className="font-semibold">WhatsApp language</h3>
        <p className="mt-1 text-sm text-slate-500">
          Patient messages use this language: visit summary, bill, investigation list, medical certificate, and
          appointment reminder. On a patient record, reception can pick a different language when that person does
          not understand this one. Login codes stay in English.
        </p>
      </div>
      <label className="max-w-sm text-sm font-medium text-slate-700">
        Default language
        <select className={fieldClass} value={language} onChange={(event) => setLanguage(event.target.value)}>
          {WHATSAPP_LANGUAGES.map((item) => (
            <option key={item.code} value={item.code}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {saved ? <p className="text-sm text-teal-700">WhatsApp language saved.</p> : null}
      <div>
        <button className={buttonClass} type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save WhatsApp language"}
        </button>
      </div>
    </form>
  );
}
