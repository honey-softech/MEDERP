export const HOSPITAL_CODE_LENGTH = 8;

/** Words that do not identify the hospital. */
const FILLER_WORDS = new Set([
  "THE",
  "OF",
  "AND",
  "FOR",
  "A",
  "AN",
  "AT",
  "IN",
  "BY",
  "TO",
  "PVT",
  "LTD",
  "LLP",
  "INC",
  "LLC",
  "PLC",
  "PRIVATE",
  "LIMITED",
  "SUPER",
  "SPECIALITY",
  "SPECIALTY",
  "MULTISPECIALITY",
  "MULTISPECIALTY",
  "MULTI",
  "GENERAL",
  "CHARITABLE",
  "TRUST",
]);

function wordsFromHospitalName(name: string) {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word && !FILLER_WORDS.has(word) && (word.length > 1 || /\d/.test(word)));
}

/** Spread letters across words so "Hanisha Clinic" stays HANISHCL, not HANICL. */
function takeFromWords(words: string[], total: number) {
  const take = words.map(() => 0);
  let remaining = total;
  for (let i = 0; i < words.length; i++) {
    const reservedForLater = words.length - i - 1;
    const give = Math.min(2, words[i].length, Math.max(1, remaining - reservedForLater));
    take[i] = give;
    remaining -= give;
  }
  for (let i = 0; i < words.length && remaining > 0; i++) {
    const extra = Math.min(remaining, words[i].length - take[i]);
    take[i] += extra;
    remaining -= extra;
  }
  return words.map((word, i) => word.slice(0, take[i])).join("").slice(0, total);
}

export function slugFromHospitalName(name: string) {
  const words = wordsFromHospitalName(name);
  if (words.length === 0) return "HOSPITAL";
  const compact = words.join("");
  if (compact.length >= HOSPITAL_CODE_LENGTH) {
    return takeFromWords(words, HOSPITAL_CODE_LENGTH);
  }
  return `${compact}HOSPITAL`.slice(0, HOSPITAL_CODE_LENGTH);
}

/** Existing hospitals may still use 3–12 character codes. */
export function isValidHospitalCode(code: string) {
  return /^[A-Z0-9-]{3,12}$/.test(code.trim().toUpperCase());
}

export function isCanonicalHospitalCode(code: string) {
  return /^[A-Z0-9]{8}$/.test(code.trim().toUpperCase());
}
