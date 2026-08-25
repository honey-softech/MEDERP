import { VITAL_RANGES, bmiLabel, formatIdealRange, vitalAlert } from "@/lib/vitals";
import type { VitalsValues } from "@/lib/vitals";

function num(value: { toString(): string } | number | null | undefined) {
  if (value == null) return "—";
  return Number(value).toString();
}

export function VitalsPanel({ vitals }: { vitals: VitalsValues }) {
  const bmi = Number(vitals.bmi);
  const bmiAlert = Number.isFinite(bmi) && (bmi < 18.5 || bmi >= 25);
  const alerts = [
    vitalAlert(vitals.temperatureC, VITAL_RANGES.temperatureC) ? `Temperature ${num(vitals.temperatureC)} °C (ideal ${formatIdealRange(VITAL_RANGES.temperatureC)})` : null,
    vitalAlert(vitals.spo2Percent, VITAL_RANGES.spo2Percent) ? `SpO2 ${vitals.spo2Percent}% (ideal ${formatIdealRange(VITAL_RANGES.spo2Percent)})` : null,
    vitalAlert(vitals.pulseBpm, VITAL_RANGES.pulseBpm) ? `Pulse ${vitals.pulseBpm} bpm (ideal ${formatIdealRange(VITAL_RANGES.pulseBpm)})` : null,
    vitalAlert(vitals.respiratoryRate, VITAL_RANGES.respiratoryRate)
      ? `Respiratory rate ${vitals.respiratoryRate} /min (ideal ${formatIdealRange(VITAL_RANGES.respiratoryRate)})`
      : null,
    vitalAlert(vitals.bpSystolic, VITAL_RANGES.bpSystolic) ? `BP systolic ${vitals.bpSystolic} mmHg (ideal ${formatIdealRange(VITAL_RANGES.bpSystolic)})` : null,
    vitalAlert(vitals.bpDiastolic, VITAL_RANGES.bpDiastolic) ? `BP diastolic ${vitals.bpDiastolic} mmHg (ideal ${formatIdealRange(VITAL_RANGES.bpDiastolic)})` : null,
    vitalAlert(vitals.bloodSugarMgDl, VITAL_RANGES.bloodSugarMgDl)
      ? `Blood sugar ${num(vitals.bloodSugarMgDl)} mg/dL (ideal ${formatIdealRange(VITAL_RANGES.bloodSugarMgDl)})`
      : null,
  ].filter((row): row is string => Boolean(row));

  return (
    <section className="rounded-2xl border border-teal-200 bg-teal-50/70 p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold text-teal-950">Nurse vitals for this consult</h3>
        {vitals.recordedByUsername ? (
          <p className="text-xs text-teal-800">
            Recorded by {vitals.recordedByUsername}
            {vitals.recordedAt
              ? ` · ${new Date(vitals.recordedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`
              : ""}
          </p>
        ) : null}
      </div>
      {alerts.length > 0 || vitals.hasFever ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          <p className="font-medium">Abnormal vitals</p>
          <ul className="mt-1 list-disc pl-5">
            {vitals.hasFever ? <li>Fever present</li> : null}
            {alerts.map((row) => (
              <li key={row}>{row}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        <Item label="Height" value={`${num(vitals.heightCm)} cm`} />
        <Item label="Weight" value={`${num(vitals.weightKg)} kg`} />
        <Item label={`BMI · ideal 18.5–24.9`} value={`${num(vitals.bmi)} · ${bmiLabel(bmi)}`} alert={bmiAlert} />
        <Item
          label={`Temperature · ideal ${formatIdealRange(VITAL_RANGES.temperatureC)}`}
          value={`${num(vitals.temperatureC)} °C`}
          alert={Boolean(vitalAlert(vitals.temperatureC, VITAL_RANGES.temperatureC))}
        />
        <Item label="Fever" value={vitals.hasFever ? "Yes" : "No"} alert={vitals.hasFever} />
        <Item
          label={`SpO2 · ideal ${formatIdealRange(VITAL_RANGES.spo2Percent)}`}
          value={vitals.spo2Percent != null ? `${vitals.spo2Percent}%` : "—"}
          alert={Boolean(vitalAlert(vitals.spo2Percent, VITAL_RANGES.spo2Percent))}
        />
        <Item
          label={`Pulse · ideal ${formatIdealRange(VITAL_RANGES.pulseBpm)}`}
          value={vitals.pulseBpm != null ? `${vitals.pulseBpm} bpm` : "—"}
          alert={Boolean(vitalAlert(vitals.pulseBpm, VITAL_RANGES.pulseBpm))}
        />
        <Item
          label={`Respiratory rate · ideal ${formatIdealRange(VITAL_RANGES.respiratoryRate)}`}
          value={vitals.respiratoryRate != null ? `${vitals.respiratoryRate} /min` : "—"}
          alert={Boolean(vitalAlert(vitals.respiratoryRate, VITAL_RANGES.respiratoryRate))}
        />
        <Item
          label={`Blood pressure · ideal ${VITAL_RANGES.bpSystolic.min}–${VITAL_RANGES.bpSystolic.max}/${VITAL_RANGES.bpDiastolic.min}–${VITAL_RANGES.bpDiastolic.max} mmHg`}
          value={bpDisplay(vitals.bpSystolic, vitals.bpDiastolic)}
          alert={Boolean(vitalAlert(vitals.bpSystolic, VITAL_RANGES.bpSystolic) || vitalAlert(vitals.bpDiastolic, VITAL_RANGES.bpDiastolic))}
        />
        <Item
          label={`Blood sugar · ideal ${formatIdealRange(VITAL_RANGES.bloodSugarMgDl)}`}
          value={vitals.bloodSugarMgDl != null ? `${num(vitals.bloodSugarMgDl)} mg/dL` : "—"}
          alert={Boolean(vitalAlert(vitals.bloodSugarMgDl, VITAL_RANGES.bloodSugarMgDl))}
        />
      </dl>
      {vitals.notes ? <p className="mt-3 rounded-xl bg-white p-3 text-sm text-slate-700">{vitals.notes}</p> : null}
    </section>
  );
}

function bpDisplay(systolic: number | null, diastolic: number | null) {
  if (systolic == null && diastolic == null) return "—";
  return `${systolic ?? "—"}/${diastolic ?? "—"} mmHg`;
}

function Item({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-teal-800">{label}</dt>
      <dd className={`mt-0.5 font-medium ${alert ? "text-red-700" : "text-slate-900"}`}>{value}</dd>
    </div>
  );
}
