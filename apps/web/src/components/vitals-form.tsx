"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClass, fieldClass } from "@/components/auth-shell";
import {
  VITAL_RANGES,
  bmiLabel,
  calculateBmi,
  feverFromTemperature,
  formatIdealRange,
  parseVitalNumber,
  vitalAlertMessage,
  vitalNamedAlert,
} from "@/lib/vitals";
import type { VitalRange, VitalsValues } from "@/lib/vitals";

export function VitalsForm({
  appointmentId,
  initial,
}: {
  appointmentId: string;
  initial?: VitalsValues | null;
}) {
  const router = useRouter();
  const [heightCm, setHeightCm] = useState(initial ? String(initial.heightCm) : "");
  const [weightKg, setWeightKg] = useState(initial ? String(initial.weightKg) : "");
  const [temperatureC, setTemperatureC] = useState(initial ? String(initial.temperatureC) : "");
  const [hasFever, setHasFever] = useState(initial?.hasFever ?? false);
  const [feverTouched, setFeverTouched] = useState(Boolean(initial));
  const [spo2Percent, setSpo2Percent] = useState(optionalStr(initial?.spo2Percent));
  const [pulseBpm, setPulseBpm] = useState(optionalStr(initial?.pulseBpm));
  const [respiratoryRate, setRespiratoryRate] = useState(optionalStr(initial?.respiratoryRate));
  const [bpSystolic, setBpSystolic] = useState(optionalStr(initial?.bpSystolic));
  const [bpDiastolic, setBpDiastolic] = useState(optionalStr(initial?.bpDiastolic));
  const [bloodSugarMgDl, setBloodSugarMgDl] = useState(initial?.bloodSugarMgDl != null ? String(initial.bloodSugarMgDl) : "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const bmi = useMemo(() => calculateBmi(Number(heightCm), Number(weightKg)), [heightCm, weightKg]);
  const autoFever = feverFromTemperature(Number(temperatureC));
  const fever = feverTouched ? hasFever : autoFever;
  const alerts = useMemo(
    () =>
      [
        vitalNamedAlert(parseVitalNumber(temperatureC), VITAL_RANGES.temperatureC),
        vitalNamedAlert(parseVitalNumber(spo2Percent), VITAL_RANGES.spo2Percent),
        vitalNamedAlert(parseVitalNumber(pulseBpm), VITAL_RANGES.pulseBpm),
        vitalNamedAlert(parseVitalNumber(respiratoryRate), VITAL_RANGES.respiratoryRate),
        vitalNamedAlert(parseVitalNumber(bpSystolic), VITAL_RANGES.bpSystolic),
        vitalNamedAlert(parseVitalNumber(bpDiastolic), VITAL_RANGES.bpDiastolic),
        vitalNamedAlert(parseVitalNumber(bloodSugarMgDl), VITAL_RANGES.bloodSugarMgDl),
      ].filter((message): message is string => Boolean(message)),
    [temperatureC, spo2Percent, pulseBpm, respiratoryRate, bpSystolic, bpDiastolic, bloodSugarMgDl],
  );

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    const response = await fetch(`/api/appointments/${appointmentId}/vitals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        heightCm,
        weightKg,
        temperatureC,
        hasFever: fever,
        spo2Percent,
        pulseBpm,
        respiratoryRate,
        bpSystolic,
        bpDiastolic,
        bloodSugarMgDl,
        notes,
      }),
    });
    const raw = await response.text();
    let data: { error?: string } = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { error: "Could not save vitals." };
    }
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not save vitals.");
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
      <h3 className="md:col-span-2 font-semibold">Nurse vitals</h3>
      <p className="md:col-span-2 text-sm text-slate-500">
        Height, weight, and temperature are mandatory. Other vitals are optional. Ideal adult ranges are shown on each field; abnormal values are flagged for the doctor.
      </p>
      <Field label="Height (cm)" value={heightCm} onChange={setHeightCm} required />
      <Field label="Weight (kg)" value={weightKg} onChange={setWeightKg} required />
      <div className="rounded-xl bg-teal-50 px-3 py-2 text-sm text-teal-900 md:col-span-2">
        BMI: <span className="font-semibold">{bmi ?? "—"}</span>
        {bmi != null ? <span className="ml-2">{bmiLabel(bmi)}</span> : <span className="ml-2 text-teal-800">Enter height and weight</span>}
        <span className="ml-2 text-teal-800">Ideal 18.5–24.9</span>
      </div>
      <Field
        label="Temperature (°C)"
        value={temperatureC}
        range={VITAL_RANGES.temperatureC}
        onChange={(value) => {
          setTemperatureC(value);
          if (!feverTouched) setHasFever(feverFromTemperature(Number(value)));
        }}
        required
      />
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input
          type="checkbox"
          checked={fever}
          onChange={(event) => {
            setFeverTouched(true);
            setHasFever(event.target.checked);
          }}
        />
        Fever present {autoFever && !feverTouched ? "(auto from temperature ≥ 38°C)" : ""}
      </label>
      <Field label="SpO2 (%, optional)" value={spo2Percent} onChange={setSpo2Percent} range={VITAL_RANGES.spo2Percent} />
      <Field label="Pulse (bpm, optional)" value={pulseBpm} onChange={setPulseBpm} range={VITAL_RANGES.pulseBpm} />
      <Field
        label="Respiratory rate (/min, optional)"
        value={respiratoryRate}
        onChange={setRespiratoryRate}
        range={VITAL_RANGES.respiratoryRate}
      />
      <Field label="BP systolic (mmHg, optional)" value={bpSystolic} onChange={setBpSystolic} range={VITAL_RANGES.bpSystolic} />
      <Field label="BP diastolic (mmHg, optional)" value={bpDiastolic} onChange={setBpDiastolic} range={VITAL_RANGES.bpDiastolic} />
      <Field
        label="Blood sugar (mg/dL, optional)"
        value={bloodSugarMgDl}
        onChange={setBloodSugarMgDl}
        range={VITAL_RANGES.bloodSugarMgDl}
      />
      <label className="md:col-span-2 text-sm font-medium text-slate-700">
        Nurse notes
        <textarea className={fieldClass} rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
      </label>
      {alerts.length > 0 ? (
        <div className="md:col-span-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <p className="font-medium">Abnormal vitals — notify the doctor</p>
          <ul className="mt-1 list-disc pl-5">
            {alerts.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {error ? <p className="md:col-span-2 text-sm text-red-600">{error}</p> : null}
      <div className="md:col-span-2">
        <button className={buttonClass} type="submit" disabled={pending}>
          {pending ? "Saving…" : initial ? "Update today's vitals" : "Save vitals for doctor"}
        </button>
      </div>
    </form>
  );
}

function optionalStr(value: number | null | undefined) {
  return value != null ? String(value) : "";
}

function Field({
  label,
  value,
  onChange,
  required,
  range,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  range?: VitalRange;
}) {
  const parsed = parseVitalNumber(value);
  const warning = range ? vitalAlertMessage(parsed, range) : null;
  return (
    <label className="text-sm font-medium text-slate-700">
      {label}
      {range ? <span className="ml-1 font-normal text-slate-500">Ideal {formatIdealRange(range)}</span> : null}
      <input
        className={`${fieldClass} ${warning ? "border-amber-400 focus:border-amber-600 focus:ring-amber-100" : ""}`}
        inputMode="decimal"
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
      />
      {warning ? <p className="mt-1 text-xs font-medium text-amber-800">{warning}</p> : null}
    </label>
  );
}
