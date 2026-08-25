import { ageLabel, prettyEnum } from "@/lib/front-desk";
import type { VitalsValues } from "@/lib/vitals";

export { parseMedications } from "@/lib/prescription-text";

function cToF(celsius: number) {
  return Math.round((celsius * 9) / 5 + 32);
}

export function generalExaminationText(vitals: VitalsValues | null) {
  return generalExaminationRows(vitals)
    .filter((row) => row.value !== "—")
    .map((row) => `${row.label}: ${row.value}`)
    .join("\n");
}

export function generalExaminationRows(vitals: VitalsValues | null) {
  const bsa =
    vitals != null
      ? Math.round(Math.sqrt((vitals.heightCm * vitals.weightKg) / 3600) * 100) / 100
      : null;
  return [
    { label: "Temperature", value: vitals ? `${vitals.temperatureC} °C (${cToF(vitals.temperatureC)} °F)` : "—" },
    { label: "Height", value: vitals ? `${vitals.heightCm} cm` : "—" },
    { label: "Weight", value: vitals ? `${vitals.weightKg} kg` : "—" },
    { label: "BMI", value: vitals ? `${vitals.bmi} kg/m²` : "—" },
    { label: "BSA", value: vitals && bsa && Number.isFinite(bsa) && bsa > 0 ? `${bsa} m²` : "—" },
    { label: "SpO2", value: vitals?.spo2Percent != null ? `${vitals.spo2Percent} %` : "—" },
    { label: "Pulse", value: vitals?.pulseBpm != null ? `${vitals.pulseBpm} bpm` : "—" },
    { label: "Respiratory rate", value: vitals?.respiratoryRate != null ? `${vitals.respiratoryRate} /min` : "—" },
    {
      label: "BP",
      value:
        vitals && (vitals.bpSystolic != null || vitals.bpDiastolic != null)
          ? `${vitals.bpSystolic ?? "—"}/${vitals.bpDiastolic ?? "—"} mmHg`
          : "—",
    },
    { label: "Blood sugar", value: vitals?.bloodSugarMgDl != null ? `${vitals.bloodSugarMgDl} mg/dL` : "—" },
    { label: "Fever", value: vitals ? (vitals.hasFever ? "Yes" : "No") : "—" },
    { label: "Vital remarks", value: vitals?.notes?.trim() || "—" },
  ];
}

export function readableClinicalText(value?: string | null) {
  if (!value) return "";
  let text = value.trim();
  for (let i = 0; i < 2; i += 1) {
    try {
      if (!/%[0-9A-Fa-f]{2}/.test(text)) break;
      text = decodeURIComponent(text.replace(/\+/g, " ")).trim();
    } catch {
      break;
    }
  }
  const fromJson = extractEmbeddedText(text);
  return fromJson || text;
}

function extractEmbeddedText(value: string) {
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return "";
  try {
    const parts: string[] = [];
    collectText(JSON.parse(trimmed), parts);
    return parts.join(" ").replace(/\s+/g, " ").trim();
  } catch {
    return "";
  }
}

function collectText(node: unknown, parts: string[]) {
  if (Array.isArray(node)) {
    for (const item of node) collectText(item, parts);
    return;
  }
  if (!node || typeof node !== "object") return;
  const record = node as Record<string, unknown>;
  if (typeof record.text === "string" && record.text.trim()) parts.push(record.text.trim());
  if (record.children) collectText(record.children, parts);
}

export function visitDateLabel(value: Date) {
  return value.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();
}

export function genderShort(gender: string) {
  if (gender === "FEMALE") return "F";
  if (gender === "MALE") return "M";
  return prettyEnum(gender);
}

export function ageGenderLine(dob: Date, gender: string) {
  return `${ageLabel(dob)} / ${genderShort(gender)}`;
}

export function encounterNumber(hospitalCode: string, scheduledAt: Date, tokenNumber?: number | null) {
  const day = scheduledAt.toISOString().slice(0, 10).replace(/-/g, "");
  if (tokenNumber) return `${hospitalCode}${day}${String(tokenNumber).padStart(4, "0")}`;
  return `${hospitalCode}${day}`;
}
