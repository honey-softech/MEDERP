export function calculateBmi(heightCm: number, weightKg: number) {
  if (!Number.isFinite(heightCm) || !Number.isFinite(weightKg) || heightCm <= 0 || weightKg <= 0) {
    return null;
  }
  const meters = heightCm / 100;
  return Math.round((weightKg / (meters * meters)) * 10) / 10;
}

export function bmiLabel(bmi: number | null) {
  if (bmi == null) return "";
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Normal";
  if (bmi < 30) return "Overweight";
  return "Obese";
}

export function feverFromTemperature(temperatureC: number) {
  return temperatureC >= 38;
}

export type VitalRange = {
  min: number;
  max: number;
  unit: string;
  label: string;
};

export const VITAL_RANGES = {
  temperatureC: { min: 36.1, max: 37.2, unit: "°C", label: "Temperature" },
  spo2Percent: { min: 95, max: 100, unit: "%", label: "SpO2" },
  pulseBpm: { min: 60, max: 100, unit: "bpm", label: "Pulse" },
  respiratoryRate: { min: 12, max: 20, unit: "/min", label: "Respiratory rate" },
  bpSystolic: { min: 90, max: 120, unit: "mmHg", label: "BP systolic" },
  bpDiastolic: { min: 60, max: 80, unit: "mmHg", label: "BP diastolic" },
  bloodSugarMgDl: { min: 70, max: 140, unit: "mg/dL", label: "Blood sugar" },
} as const satisfies Record<string, VitalRange>;

export function formatIdealRange(range: Pick<VitalRange, "min" | "max" | "unit">) {
  return `${range.min}–${range.max} ${range.unit}`;
}

export function parseVitalNumber(value: string | number | null | undefined) {
  const raw = value == null ? "" : String(value).trim();
  if (raw === "") return null;
  const n = typeof value === "number" ? value : Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function vitalAlert(value: number | null | undefined, range: Pick<VitalRange, "min" | "max">) {
  if (value == null || !Number.isFinite(value)) return null;
  if (value < range.min) return "low" as const;
  if (value > range.max) return "high" as const;
  return null;
}

export function vitalAlertMessage(value: number | null | undefined, range: VitalRange) {
  const alert = vitalAlert(value, range);
  if (!alert) return null;
  return `${alert === "low" ? "Low" : "High"} — ideal ${formatIdealRange(range)}`;
}

export function vitalNamedAlert(value: number | null | undefined, range: VitalRange) {
  const message = vitalAlertMessage(value, range);
  return message ? `${range.label}: ${message}` : null;
}

export function parseRequiredNumber(value: unknown, label: string, min: number, max: number) {
  const n = typeof value === "number" ? value : Number(String(value ?? "").trim());
  if (!Number.isFinite(n) || n < min || n > max) {
    return { error: `${label} is required and must be between ${min} and ${max}.` as const };
  }
  return { value: n };
}

export function parseOptionalNumber(value: unknown, label: string, min: number, max: number) {
  const raw = value == null ? "" : String(value).trim();
  if (raw === "") return { value: null };
  const n = typeof value === "number" ? value : Number(raw);
  if (!Number.isFinite(n) || n < min || n > max) {
    return { error: `${label} must be between ${min} and ${max}.` as const };
  }
  return { value: n };
}

export type VitalsValues = {
  heightCm: number;
  weightKg: number;
  bmi: number;
  temperatureC: number;
  hasFever: boolean;
  spo2Percent: number | null;
  pulseBpm: number | null;
  respiratoryRate: number | null;
  bpSystolic: number | null;
  bpDiastolic: number | null;
  bloodSugarMgDl: number | null;
  notes: string | null;
  recordedByUsername?: string;
  recordedAt?: string;
};

export function toVitalsValues(row: {
  heightCm: { toString(): string } | number;
  weightKg: { toString(): string } | number;
  bmi: { toString(): string } | number;
  temperatureC: { toString(): string } | number;
  hasFever: boolean;
  spo2Percent: number | null;
  pulseBpm: number | null;
  respiratoryRate: number | null;
  bpSystolic: number | null;
  bpDiastolic: number | null;
  bloodSugarMgDl: { toString(): string } | number | null;
  notes: string | null;
  recordedByUsername: string;
  recordedAt: Date;
}): VitalsValues {
  return {
    heightCm: Number(row.heightCm),
    weightKg: Number(row.weightKg),
    bmi: Number(row.bmi),
    temperatureC: Number(row.temperatureC),
    hasFever: row.hasFever,
    spo2Percent: row.spo2Percent,
    pulseBpm: row.pulseBpm,
    respiratoryRate: row.respiratoryRate,
    bpSystolic: row.bpSystolic,
    bpDiastolic: row.bpDiastolic,
    bloodSugarMgDl: row.bloodSugarMgDl == null ? null : Number(row.bloodSugarMgDl),
    notes: row.notes,
    recordedByUsername: row.recordedByUsername,
    recordedAt: row.recordedAt.toISOString(),
  };
}
