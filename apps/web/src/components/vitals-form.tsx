"use client";

import { useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClass, fieldClass, textareaClass } from "@/components/auth-shell";
import {
  VITAL_RANGES,
  bmiLabel,
  calculateBmi,
  feverFromTemperature,
  formatIdealRange,
  parseVitalNumber,
  vitalAlert,
} from "@/lib/vitals";
import type { VitalRange, VitalsValues } from "@/lib/vitals";

export function VitalsForm({
  appointmentId,
  initial,
  returnTo = "/nurse",
  heading = "Nurse vitals",
}: {
  appointmentId: string;
  initial?: VitalsValues | null;
  /** After save, return to nurse station (or another list). */
  returnTo?: string;
  heading?: string;
}) {
  const router = useRouter();
  const baseId = useId();
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
  const bmiOutside = bmi != null && (bmi < 18.5 || bmi >= 25);
  const doctorWillSee = useMemo(
    () =>
      bmiOutside ||
      [
        vitalAlert(parseVitalNumber(temperatureC), VITAL_RANGES.temperatureC),
        vitalAlert(parseVitalNumber(pulseBpm), VITAL_RANGES.pulseBpm),
        vitalAlert(parseVitalNumber(spo2Percent), VITAL_RANGES.spo2Percent),
        vitalAlert(parseVitalNumber(bpSystolic), VITAL_RANGES.bpSystolic),
        vitalAlert(parseVitalNumber(bpDiastolic), VITAL_RANGES.bpDiastolic),
        vitalAlert(parseVitalNumber(respiratoryRate), VITAL_RANGES.respiratoryRate),
        vitalAlert(parseVitalNumber(bloodSugarMgDl), VITAL_RANGES.bloodSugarMgDl),
      ].some(Boolean),
    [bmiOutside, temperatureC, pulseBpm, spo2Percent, bpSystolic, bpDiastolic, respiratoryRate, bloodSugarMgDl],
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
    router.push(returnTo);
    router.refresh();
  }

  const temperatureSupport = rangeSupport(temperatureC, VITAL_RANGES.temperatureC);
  const pulseSupport = rangeSupport(pulseBpm, VITAL_RANGES.pulseBpm);
  const spo2Support = rangeSupport(spo2Percent, VITAL_RANGES.spo2Percent);
  const respiratorySupport = rangeSupport(respiratoryRate, VITAL_RANGES.respiratoryRate);
  const sugarSupport = rangeSupport(bloodSugarMgDl, VITAL_RANGES.bloodSugarMgDl);
  const pressure = pressureSupport(bpSystolic, bpDiastolic);

  return (
    <form onSubmit={onSubmit} aria-label={heading} className="space-y-3">

      <fieldset className="min-w-0 border-0 p-0">
        <legend className="text-sm font-semibold text-text-primary">Body size</legend>
        <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
          <Field
            id={`${baseId}-height`}
            label="Height"
            unit="cm"
            value={heightCm}
            onChange={setHeightCm}
            required
          />
          <Field
            id={`${baseId}-weight`}
            label="Weight"
            unit="kg"
            value={weightKg}
            onChange={setWeightKg}
            required
          />
          <div className="sm:col-span-2">
            <BmiResult bmi={bmi} outside={bmiOutside} />
          </div>
        </div>
      </fieldset>

      <fieldset className="min-w-0 border-0 p-0">
        <legend className="text-sm font-semibold text-text-primary">
          Readings
          <span className="ml-2 font-normal text-text-secondary">Leave a line blank if it was not taken.</span>
        </legend>
        <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
          <div>
            <Field
              id={`${baseId}-temperature`}
              label="Temperature"
              unit="°C"
              value={temperatureC}
              onChange={(value) => {
                setTemperatureC(value);
                if (!feverTouched) setHasFever(feverFromTemperature(Number(value)));
              }}
              required
              hint={temperatureSupport.hint}
              warning={temperatureSupport.warning}
            />
            <label className="mt-1 flex items-center gap-2 text-sm text-text-primary">
              <input
                type="checkbox"
                checked={fever}
                onChange={(event) => {
                  setFeverTouched(true);
                  setHasFever(event.target.checked);
                }}
              />
              <span className="font-medium">Fever</span>
              <span className="text-xs font-normal text-text-secondary">From 38°C. You can change it.</span>
            </label>
          </div>
          <Field
            id={`${baseId}-pulse`}
            label="Pulse"
            unit="bpm"
            value={pulseBpm}
            onChange={setPulseBpm}
            hint={pulseSupport.hint}
            warning={pulseSupport.warning}
          />
          <Field
            id={`${baseId}-spo2`}
            label="SpO2"
            unit="%"
            value={spo2Percent}
            onChange={setSpo2Percent}
            hint={spo2Support.hint}
            warning={spo2Support.warning}
          />
          <Field
            id={`${baseId}-respiratory`}
            label="Respiratory rate"
            unit="/min"
            value={respiratoryRate}
            onChange={setRespiratoryRate}
            hint={respiratorySupport.hint}
            warning={respiratorySupport.warning}
          />
          <fieldset className="min-w-0 border-0 p-0">
            <legend className="text-sm font-medium text-text-primary">Blood pressure</legend>
            <div className="mt-1 flex items-center gap-2">
              <PressureInput
                id={`${baseId}-bp-systolic`}
                label="Systolic"
                value={bpSystolic}
                onChange={setBpSystolic}
                describedBy={`${baseId}-bp-support`}
                warning={pressure.systolicWarning}
              />
              <span className="text-sm text-text-secondary" aria-hidden>
                /
              </span>
              <PressureInput
                id={`${baseId}-bp-diastolic`}
                label="Diastolic"
                value={bpDiastolic}
                onChange={setBpDiastolic}
                describedBy={`${baseId}-bp-support`}
                warning={pressure.diastolicWarning}
              />
              <span className="shrink-0 text-sm text-text-secondary">mmHg</span>
            </div>
            <p
              id={`${baseId}-bp-support`}
              className={`mt-1 text-xs ${pressure.warning ? "font-medium text-amber-800" : "text-text-secondary"}`}
            >
              {pressure.line}
            </p>
          </fieldset>
          <Field
            id={`${baseId}-sugar`}
            label="Blood sugar"
            unit="mg/dL"
            value={bloodSugarMgDl}
            onChange={setBloodSugarMgDl}
            hint={sugarSupport.hint}
            warning={sugarSupport.warning}
          />
        </div>
      </fieldset>

      <label htmlFor={`${baseId}-notes`} className="block text-sm font-medium text-text-primary">
        Nurse notes
        <textarea
          id={`${baseId}-notes`}
          className={`${textareaClass} !min-h-0`}
          rows={2}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </label>

      <div className="space-y-2">
        {doctorWillSee ? (
          <p className="text-sm text-text-secondary">The doctor will see readings outside the ideal range.</p>
        ) : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
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

function rangeSupport(value: string, range: VitalRange) {
  const alert = vitalAlert(parseVitalNumber(value), range);
  const ideal = `Ideal ${formatIdealRange(range)}`;
  if (!alert) return { hint: ideal, warning: null as string | null };
  const word = alert === "low" ? "Low" : "High";
  return { hint: null, warning: `${word} · ideal ${formatIdealRange(range)}` };
}

function pressureSupport(systolic: string, diastolic: string) {
  const sys = parseVitalNumber(systolic);
  const dia = parseVitalNumber(diastolic);
  const ideal = `Ideal ${VITAL_RANGES.bpSystolic.min}–${VITAL_RANGES.bpSystolic.max} / ${VITAL_RANGES.bpDiastolic.min}–${VITAL_RANGES.bpDiastolic.max} mmHg`;
  const sysAlert = vitalAlert(sys, VITAL_RANGES.bpSystolic);
  const diaAlert = vitalAlert(dia, VITAL_RANGES.bpDiastolic);
  const oneSide = (sys == null) !== (dia == null);

  if (oneSide) {
    return { line: "Enter both numbers", warning: false, systolicWarning: false, diastolicWarning: false };
  }
  if (sys != null && dia != null && sys <= dia) {
    return {
      line: "Systolic should be above diastolic",
      warning: false,
      systolicWarning: false,
      diastolicWarning: false,
    };
  }

  const parts = [
    sysAlert ? `Systolic ${sysAlert}` : null,
    diaAlert ? `Diastolic ${diaAlert}` : null,
  ].filter((part): part is string => Boolean(part));
  if (parts.length > 0) {
    const sentence = parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(", ");
    return {
      line: `${sentence} · ideal ${VITAL_RANGES.bpSystolic.min}–${VITAL_RANGES.bpSystolic.max} / ${VITAL_RANGES.bpDiastolic.min}–${VITAL_RANGES.bpDiastolic.max} mmHg`,
      warning: true,
      systolicWarning: Boolean(sysAlert),
      diastolicWarning: Boolean(diaAlert),
    };
  }
  return { line: ideal, warning: false, systolicWarning: false, diastolicWarning: false };
}

function BmiResult({ bmi, outside }: { bmi: number | null; outside: boolean }) {
  if (bmi == null) {
    return <p className="text-sm text-text-secondary">Enter height and weight · ideal 18.5–24.9</p>;
  }
  return (
    <p className={`text-sm ${outside ? "font-medium text-amber-800" : "text-text-secondary"}`}>
      BMI {bmi} · {bmiLabel(bmi)} · ideal 18.5–24.9
    </p>
  );
}

function Field({
  id,
  label,
  unit,
  value,
  onChange,
  required,
  hint,
  warning,
}: {
  id: string;
  label: string;
  unit: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  hint?: string | null;
  warning?: string | null;
}) {
  const support = warning ?? hint;
  const supportId = support ? `${id}-support` : undefined;
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-text-primary">
        {label}
        {required ? <span className="ml-2 text-xs font-normal text-text-secondary">Required</span> : null}
      </label>
      <div className="relative mt-1">
        <input
          id={id}
          className={`${fieldClass} !mt-0 pr-20 ${warning ? "border-amber-400 focus:border-amber-600 focus:ring-amber-100" : ""}`}
          inputMode="decimal"
          value={value}
          required={required}
          aria-invalid={warning ? true : undefined}
          aria-describedby={supportId}
          onChange={(event) => onChange(event.target.value)}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-text-secondary">
          {unit}
        </span>
      </div>
      {support ? (
        <p id={supportId} className={`mt-1 text-xs ${warning ? "font-medium text-amber-800" : "text-text-secondary"}`}>
          {support}
        </p>
      ) : null}
    </div>
  );
}

function PressureInput({
  id,
  label,
  value,
  onChange,
  describedBy,
  warning,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  describedBy: string;
  warning: boolean;
}) {
  return (
    <input
      id={id}
      aria-label={label}
      aria-describedby={describedBy}
      aria-invalid={warning ? true : undefined}
      className={`${fieldClass} !mt-0 min-w-0 ${warning ? "border-amber-400 focus:border-amber-600 focus:ring-amber-100" : ""}`}
      inputMode="decimal"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
