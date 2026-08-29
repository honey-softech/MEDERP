import { VITAL_RANGES, bmiLabel, formatIdealRange, vitalAlert } from "@/lib/vitals";
import type { VitalsValues } from "@/lib/vitals";

function num(value: { toString(): string } | number | null | undefined) {
  if (value == null) return "—";
  return Number(value).toString();
}

export function VitalsPanel({
  vitals,
  compact = false,
}: {
  vitals: VitalsValues | null;
  compact?: boolean;
}) {
  const recorded = Boolean(vitals);
  const bmi = vitals != null ? Number(vitals.bmi) : NaN;
  const bmiAlert = recorded && Number.isFinite(bmi) && (bmi < 18.5 || bmi >= 25);
  const alerts = vitals
    ? [
        vitals.hasFever ? "Fever" : null,
        vitalAlert(vitals.temperatureC, VITAL_RANGES.temperatureC) ? `Temp ${num(vitals.temperatureC)}°C` : null,
        vitalAlert(vitals.spo2Percent, VITAL_RANGES.spo2Percent) ? `SpO2 ${vitals.spo2Percent}%` : null,
        vitalAlert(vitals.pulseBpm, VITAL_RANGES.pulseBpm) ? `Pulse ${vitals.pulseBpm}` : null,
        vitalAlert(vitals.respiratoryRate, VITAL_RANGES.respiratoryRate) ? `RR ${vitals.respiratoryRate}` : null,
        vitalAlert(vitals.bpSystolic, VITAL_RANGES.bpSystolic) || vitalAlert(vitals.bpDiastolic, VITAL_RANGES.bpDiastolic)
          ? `BP ${bpDisplay(vitals.bpSystolic, vitals.bpDiastolic)}`
          : null,
        vitalAlert(vitals.bloodSugarMgDl, VITAL_RANGES.bloodSugarMgDl) ? `Sugar ${num(vitals.bloodSugarMgDl)}` : null,
      ].filter((row): row is string => Boolean(row))
    : [];

  if (compact) {
    return (
      <section
        className={`rounded-xl border p-2.5 ${
          recorded ? "border-teal-200 bg-teal-50/70" : "border-warning-bg bg-warning-bg"
        }`}
      >
        <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-1">
          <h3 className={`text-sm font-semibold ${recorded ? "text-teal-950" : "text-text-primary"}`}>Vitals</h3>
          {vitals?.recordedByUsername ? (
            <p className="text-[10px] text-teal-800">{vitals.recordedByUsername}</p>
          ) : (
            <p className="text-[10px] font-medium text-warning">Not recorded</p>
          )}
        </div>
        {alerts.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-1">
            {alerts.map((row) => (
              <span key={row} className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-800">
                {row}
              </span>
            ))}
          </div>
        ) : null}
        <dl className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs 2xl:grid-cols-3">
          <Item
            compact
            label="Ht/Wt"
            value={vitals ? `${num(vitals.heightCm)}/${num(vitals.weightKg)}` : "—/—"}
          />
          <Item
            compact
            label="BMI"
            value={vitals ? `${num(vitals.bmi)} · ${bmiLabel(bmi)}` : "—"}
            alert={bmiAlert}
          />
          <Item
            compact
            label="Temp"
            value={vitals ? `${num(vitals.temperatureC)}°C` : "—"}
            alert={Boolean(vitals && vitalAlert(vitals.temperatureC, VITAL_RANGES.temperatureC))}
          />
          <Item
            compact
            label="SpO2"
            value={vitals?.spo2Percent != null ? `${vitals.spo2Percent}%` : "—"}
            alert={Boolean(vitals && vitalAlert(vitals.spo2Percent, VITAL_RANGES.spo2Percent))}
          />
          <Item
            compact
            label="Pulse"
            value={vitals?.pulseBpm != null ? `${vitals.pulseBpm}` : "—"}
            alert={Boolean(vitals && vitalAlert(vitals.pulseBpm, VITAL_RANGES.pulseBpm))}
          />
          <Item
            compact
            label="BP"
            value={vitals ? bpDisplay(vitals.bpSystolic, vitals.bpDiastolic) : "—/—"}
            alert={Boolean(
              vitals &&
                (vitalAlert(vitals.bpSystolic, VITAL_RANGES.bpSystolic) ||
                  vitalAlert(vitals.bpDiastolic, VITAL_RANGES.bpDiastolic)),
            )}
          />
        </dl>
      </section>
    );
  }

  if (!vitals) {
    return (
      <section className="rounded-2xl border border-warning-bg bg-warning-bg p-5">
        <h3 className="font-semibold text-text-primary">Nurse vitals for this consult</h3>
        <p className="mt-1 text-sm text-text-secondary">Not recorded yet</p>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <Item label="Height" value="—" />
          <Item label="Weight" value="—" />
          <Item label="BMI · ideal 18.5–24.9" value="—" />
          <Item label={`Temperature · ideal ${formatIdealRange(VITAL_RANGES.temperatureC)}`} value="—" />
          <Item label="Fever" value="—" />
          <Item label={`SpO2 · ideal ${formatIdealRange(VITAL_RANGES.spo2Percent)}`} value="—" />
          <Item label={`Pulse · ideal ${formatIdealRange(VITAL_RANGES.pulseBpm)}`} value="—" />
          <Item label={`Respiratory rate · ideal ${formatIdealRange(VITAL_RANGES.respiratoryRate)}`} value="—" />
          <Item
            label={`Blood pressure · ideal ${VITAL_RANGES.bpSystolic.min}–${VITAL_RANGES.bpSystolic.max}/${VITAL_RANGES.bpDiastolic.min}–${VITAL_RANGES.bpDiastolic.max} mmHg`}
            value="—/—"
          />
          <Item label={`Blood sugar · ideal ${formatIdealRange(VITAL_RANGES.bloodSugarMgDl)}`} value="—" />
        </dl>
      </section>
    );
  }

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
      {alerts.length > 0 ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          <p className="font-medium">Abnormal vitals</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {alerts.map((row) => (
              <span key={row} className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-medium">
                {row}
              </span>
            ))}
          </div>
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
          alert={Boolean(
            vitalAlert(vitals.bpSystolic, VITAL_RANGES.bpSystolic) ||
              vitalAlert(vitals.bpDiastolic, VITAL_RANGES.bpDiastolic),
          )}
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
  return `${systolic ?? "—"}/${diastolic ?? "—"}`;
}

function Item({
  label,
  value,
  alert,
  compact,
}: {
  label: string;
  value: string;
  alert?: boolean;
  compact?: boolean;
}) {
  return (
    <div>
      <dt className={`uppercase tracking-wide text-teal-800 ${compact ? "text-[10px]" : "text-xs"}`}>{label}</dt>
      <dd className={`mt-0.5 font-medium ${compact ? "text-xs" : ""} ${alert ? "text-red-700" : "text-slate-900"}`}>
        {value}
      </dd>
    </div>
  );
}
