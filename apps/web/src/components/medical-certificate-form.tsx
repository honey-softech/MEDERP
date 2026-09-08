"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PatientPicker, type PatientOption } from "@/components/patient-picker";
import { buttonClass, fieldClass, textareaClass } from "@/components/auth-shell";
import { FITNESS_PURPOSES, type CertificateType } from "@/lib/medical-certificates";

export function MedicalCertificateForm({
  initialPatient,
  appointmentId,
}: {
  initialPatient?: PatientOption | null;
  appointmentId?: string | null;
}) {
  const router = useRouter();
  const [type, setType] = useState<CertificateType>("SICK_LEAVE");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/certificates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId: form.get("patientId"),
        appointmentId: form.get("appointmentId") || undefined,
        type: form.get("type"),
        diagnosis: form.get("diagnosis"),
        remarks: form.get("remarks"),
        restFrom: form.get("restFrom"),
        restTo: form.get("restTo"),
        fitFor: form.get("fitFor"),
        purpose: form.get("purpose"),
      }),
    });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not issue the certificate.");
      return;
    }
    router.push(`/certificates/${data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid max-w-3xl gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2">
      {appointmentId ? <input type="hidden" name="appointmentId" value={appointmentId} /> : null}
      <div className="sm:col-span-2">
        <PatientPicker
          initial={initialPatient}
          registerHref="/patients/new"
          label="Patient"
        />
      </div>
      <label className="text-sm font-medium text-slate-700 sm:col-span-2">
        Certificate type
        <select
          className={fieldClass}
          name="type"
          value={type}
          onChange={(event) => setType(event.target.value as CertificateType)}
          required
        >
          <option value="SICK_LEAVE">Sick leave / rest</option>
          <option value="FITNESS">Fitness to resume</option>
          <option value="GENERAL">General medical certificate</option>
        </select>
      </label>
      <label className="text-sm font-medium text-slate-700 sm:col-span-2">
        Diagnosis
        <input className={fieldClass} name="diagnosis" required placeholder="e.g. Viral fever" />
      </label>
      {type === "SICK_LEAVE" ? (
        <>
          <label className="text-sm font-medium text-slate-700">
            Rest from
            <input className={fieldClass} type="date" name="restFrom" required />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Rest to
            <input className={fieldClass} type="date" name="restTo" required />
          </label>
        </>
      ) : null}
      {type === "FITNESS" ? (
        <label className="text-sm font-medium text-slate-700 sm:col-span-2">
          Fit for
          <select className={fieldClass} name="fitFor" required defaultValue="WORK">
            {FITNESS_PURPOSES.map((purpose) => (
              <option key={purpose} value={purpose}>
                {purpose === "WORK"
                  ? "Work"
                  : purpose === "SCHOOL"
                    ? "School"
                    : purpose === "SPORTS"
                      ? "Sports / physical activity"
                      : "Travel"}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {type === "GENERAL" ? (
        <label className="text-sm font-medium text-slate-700 sm:col-span-2">
          Purpose
          <textarea
            className={textareaClass}
            name="purpose"
            required
            placeholder="e.g. is under treatment and requires light duties for two weeks"
          />
        </label>
      ) : null}
      <label className="text-sm font-medium text-slate-700 sm:col-span-2">
        Remarks
        <textarea className={textareaClass} name="remarks" placeholder="Optional" />
      </label>
      <div className="sm:col-span-2">
        <button className={buttonClass} type="submit" disabled={pending}>
          {pending ? "Issuing…" : "Issue certificate"}
        </button>
      </div>
      {error ? <p className="sm:col-span-2 text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
