export type Interval = { start: Date; end: Date };

export function zonedTimeToUtc(dateKey: string, minutes: number, timeZone: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(new Date(utcGuess))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  const asZoned = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return new Date(utcGuess - (asZoned - utcGuess));
}

export function dateKeyInZone(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function addDaysToDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  const y = next.getUTCFullYear();
  const m = String(next.getUTCMonth() + 1).padStart(2, "0");
  const d = String(next.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatSlotLabel(start: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(start);
}

export function overlaps(a: Interval, b: Interval) {
  return a.start < b.end && a.end > b.start;
}

export function expandInterval(interval: Interval, bufferMs: number): Interval {
  return {
    start: new Date(interval.start.getTime() - bufferMs),
    end: new Date(interval.end.getTime() + bufferMs),
  };
}

export function buildCandidateSlots(params: {
  dateKey: string;
  timeZone: string;
  dayStartMin: number;
  dayEndMin: number;
  durationMins: number;
  now?: Date;
}): Interval[] {
  const slots: Interval[] = [];
  for (
    let minute = params.dayStartMin;
    minute + params.durationMins <= params.dayEndMin;
    minute += params.durationMins
  ) {
    const start = zonedTimeToUtc(params.dateKey, minute, params.timeZone);
    const end = new Date(start.getTime() + params.durationMins * 60_000);
    if (params.now && start.getTime() <= params.now.getTime()) continue;
    slots.push({ start, end });
  }
  return slots;
}

export function availableSlots(candidates: Interval[], blocked: Interval[]) {
  return candidates.filter((slot) => !blocked.some((block) => overlaps(slot, block)));
}
