/** Client-safe prescription line parsing (no server imports). */

export function parseMedications(prescription?: string | null) {
  if (!prescription) return [];
  return prescription
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\s+\|\|\s+|\s+\|\s+/);
      if (parts.length >= 2) {
        return { name: parts[0].trim(), notes: parts.slice(1).join(" | ").trim() };
      }
      const dash = line.split(/\s+[–-]\s+/);
      if (dash.length >= 2) {
        return { name: dash[0].trim(), notes: dash.slice(1).join(" - ").trim() };
      }
      return { name: line, notes: "" };
    });
}
