/** Split free-text assessment fields into chips and return the most common labels. */
export function rankTerms(rawValues: Array<string | null | undefined>, limit = 8): string[] {
  const counts = new Map<string, { label: string; count: number }>();
  for (const raw of rawValues) {
    if (!raw) continue;
    const seen = new Set<string>();
    for (const part of raw.split(/[,;\n]+/)) {
      const label = part.trim();
      if (!label) continue;
      const key = label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const current = counts.get(key);
      if (current) current.count += 1;
      else counts.set(key, { label, count: 1 });
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit)
    .map((row) => row.label);
}

export function clinicDayKey(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
