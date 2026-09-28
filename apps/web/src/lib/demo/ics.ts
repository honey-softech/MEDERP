function foldLine(line: string) {
  const chunks: string[] = [];
  let rest = line;
  while (rest.length > 73) {
    chunks.push(rest.slice(0, 73));
    rest = ` ${rest.slice(73)}`;
  }
  chunks.push(rest);
  return chunks.join("\r\n");
}

function icsStamp(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function buildDemoIcs(params: {
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  description: string;
  method: "REQUEST" | "CANCEL" | "PUBLISH";
  meetLink?: string | null;
}) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MedERP//Demo//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${params.method}`,
    "BEGIN:VEVENT",
    `UID:${params.uid}`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(params.start)}`,
    `DTEND:${icsStamp(params.end)}`,
    `SUMMARY:${escapeText(params.summary)}`,
    `DESCRIPTION:${escapeText(params.description)}`,
    `STATUS:${params.method === "CANCEL" ? "CANCELLED" : "CONFIRMED"}`,
  ];
  if (params.meetLink) {
    lines.push(`URL:${params.meetLink}`);
  }
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.map(foldLine).join("\r\n");
}
