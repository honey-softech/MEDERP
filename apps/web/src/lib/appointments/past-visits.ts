export type PastVisitVitals = {
  bpSystolic: number | null;
  bpDiastolic: number | null;
  pulseBpm: number | null;
  temperatureC: number | null;
  spo2Percent: number | null;
  weightKg: number | null;
};

export type PastVisitItem = {
  id: string;
  when: string;
  at: string;
  doctor: string;
  doctorId: string;
  department: string;
  diagnosis: string;
  chiefComplaint: string;
  handwritten?: boolean;
  summaryApproved: boolean;
  summaryAlreadySent?: boolean;
  reports: { id: string; fileName: string }[];
  prescription: string;
  advice: string;
  followUpLabel: string | null;
  vitals: PastVisitVitals | null;
};

export function relativeVisitLabel(iso: string, now = Date.now()) {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const days = Math.round((now - then) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) {
    const weeks = Math.max(1, Math.round(days / 7));
    return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
  }
  if (days < 365) {
    const months = Math.max(1, Math.round(days / 30));
    return months === 1 ? "1 month ago" : `${months} months ago`;
  }
  const years = Math.max(1, Math.round(days / 365));
  return years === 1 ? "1 year ago" : `${years} years ago`;
}

export function vitalsStrip(vitals: PastVisitVitals | null) {
  if (!vitals) return "";
  const parts: string[] = [];
  if (vitals.bpSystolic != null && vitals.bpDiastolic != null) {
    parts.push(`BP ${vitals.bpSystolic}/${vitals.bpDiastolic}`);
  }
  if (vitals.pulseBpm != null) parts.push(`Pulse ${vitals.pulseBpm}`);
  if (vitals.temperatureC != null) parts.push(`Temp ${trimNumber(vitals.temperatureC, 1)}°`);
  if (vitals.spo2Percent != null) parts.push(`SpO2 ${vitals.spo2Percent}%`);
  if (vitals.weightKg != null) parts.push(`Wt ${trimNumber(vitals.weightKg, 1)} kg`);
  return parts.join(" · ");
}

function trimNumber(value: number, digits: number) {
  const fixed = value.toFixed(digits);
  return fixed.replace(/\.0$/, "");
}

function signed(value: number, digits: number) {
  const text = trimNumber(Math.abs(value), digits);
  if (value > 0) return `+${text}`;
  if (value < 0) return `−${text}`;
  return "0";
}

/** Change from the earlier reading to the later one. Empty when nothing can be compared. */
export function vitalsDeltaLine(
  later: PastVisitVitals | null | undefined,
  earlier: PastVisitVitals | null | undefined,
  label = "Since last visit",
) {
  if (!later || !earlier) return "";
  const parts: string[] = [];
  if (
    later.bpSystolic != null &&
    later.bpDiastolic != null &&
    earlier.bpSystolic != null &&
    earlier.bpDiastolic != null
  ) {
    const sys = later.bpSystolic - earlier.bpSystolic;
    const dia = later.bpDiastolic - earlier.bpDiastolic;
    if (sys !== 0 || dia !== 0) parts.push(`BP ${signed(sys, 0)}/${signed(dia, 0)}`);
  }
  pushDelta(parts, "Pulse", later.pulseBpm, earlier.pulseBpm, 0, 1);
  pushDelta(parts, "Temp", later.temperatureC, earlier.temperatureC, 1, 0.1, "°");
  pushDelta(parts, "SpO2", later.spo2Percent, earlier.spo2Percent, 0, 1, "%");
  pushDelta(parts, "Wt", later.weightKg, earlier.weightKg, 1, 0.1, " kg");
  if (parts.length === 0) return "";
  return `${label} · ${parts.join(" · ")}`;
}

function pushDelta(
  parts: string[],
  name: string,
  later: number | null | undefined,
  earlier: number | null | undefined,
  digits: number,
  min: number,
  suffix = "",
) {
  if (later == null || earlier == null) return;
  const diff = later - earlier;
  if (!Number.isFinite(diff) || Math.abs(diff) < min) return;
  parts.push(`${name} ${signed(diff, digits)}${suffix}`);
}
