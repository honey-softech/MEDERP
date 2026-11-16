export type MedicineConfidence = "high" | "low" | "none";

export type RankedMedicine = {
  name: string;
  matched: boolean;
  confidence: MedicineConfidence;
  alternatives: string[];
};

const INDEPENDENT: Record<string, string> = {
  அ: "a",
  ஆ: "aa",
  இ: "i",
  ஈ: "ii",
  உ: "u",
  ஊ: "uu",
  எ: "e",
  ஏ: "ee",
  ஐ: "ai",
  ஒ: "o",
  ஓ: "oo",
  ஔ: "au",
};

const SIGNS: Record<string, string> = {
  "ா": "aa",
  "ி": "i",
  "ீ": "ii",
  "ு": "u",
  "ூ": "uu",
  "ெ": "e",
  "ே": "ee",
  "ை": "ai",
  "ொ": "o",
  "ோ": "oo",
  "ௌ": "au",
  "்": "",
};

const CONS: Record<string, string> = {
  க: "k",
  ங: "ng",
  ச: "c",
  ஞ: "ny",
  ட: "t",
  ண: "n",
  த: "t",
  ந: "n",
  ப: "p",
  ம: "m",
  ய: "y",
  ர: "r",
  ல: "l",
  வ: "v",
  ழ: "l",
  ள: "l",
  ற: "r",
  ன: "n",
  ஜ: "j",
  ஷ: "sh",
  ஸ: "s",
  ஹ: "h",
};

/** Rough Tamil-to-Latin so a spoken drug name can be compared with the catalog. */
export function transliterateTamil(input: string) {
  let out = "";
  const chars = [...input];
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i] ?? "";
    if (INDEPENDENT[ch]) {
      out += INDEPENDENT[ch];
      continue;
    }
    const consonant = CONS[ch];
    if (!consonant) {
      out += ch;
      continue;
    }
    const next = chars[i + 1];
    if (next && SIGNS[next] !== undefined) {
      out += consonant + SIGNS[next];
      i += 1;
      continue;
    }
    out += `${consonant}a`;
  }
  return out;
}

function latinOf(value: string) {
  const source = /[\u0B80-\u0BFF]/.test(value) ? transliterateTamil(value) : value;
  return source
    .toLowerCase()
    .replace(/\b(tablets?|capsules?|syrups?|suspensions?|injections?|drops|creams?|gels?|mg|ml)\b/g, " ")
    .replace(/aa/g, "a")
    .replace(/ii/g, "i")
    .replace(/uu/g, "u")
    .replace(/ee/g, "e")
    .replace(/oo/g, "o")
    .replace(/ph/g, "f")
    .replace(/th/g, "t")
    .replace(/c/g, "s");
}

function brandKey(value: string) {
  return latinOf(value)
    .replace(/[^a-z]/g, "")
    .replace(/(.)\1+/g, "$1");
}

function skeleton(value: string) {
  return brandKey(value).replace(/[aeiou]/g, "");
}

export function medicineStrength(value: string) {
  const labeled = value.toLowerCase().match(/(\d{2,4})\s*(mg|mcg|g|ml)\b/);
  if (labeled?.[1]) return labeled[1];
  const bare = value.match(/(?:^|[^\d])(\d{2,4})(?:[^\d]|$)/);
  return bare?.[1] ?? null;
}

function strengthsCompatible(spoken: string, candidate: string) {
  const left = medicineStrength(spoken);
  const right = medicineStrength(candidate);
  if (!left || !right) return true;
  return left === right;
}

function levenshtein(left: string, right: string) {
  const a = left.slice(0, 40);
  const b = right.slice(0, 40);
  const rows = Array.from({ length: a.length + 1 }, (_, index) => index);
  for (let j = 1; j <= b.length; j++) {
    let previous = rows[0] ?? 0;
    rows[0] = j;
    for (let i = 1; i <= a.length; i++) {
      const current = rows[i] ?? 0;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      rows[i] = Math.min(current + 1, (rows[i - 1] ?? 0) + 1, previous + cost);
      previous = current;
    }
  }
  return rows[a.length] ?? Math.max(a.length, b.length);
}

function similarity(spoken: string, candidate: string) {
  const left = brandKey(spoken);
  const right = brandKey(candidate);
  if (!left || !right) return 0;
  if (left === right) return 1;
  const leftSkeleton = skeleton(spoken);
  const rightSkeleton = skeleton(candidate);
  if (leftSkeleton.length >= 4 && leftSkeleton === rightSkeleton) return 0.92;
  if (
    left.length >= 5 &&
    right.length >= 5 &&
    Math.abs(left.length - right.length) <= 2 &&
    (right.startsWith(left) || left.startsWith(right))
  ) {
    return 0.88;
  }
  const distance = levenshtein(left, right);
  return 1 - distance / Math.max(left.length, right.length);
}

function sameName(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase() || (brandKey(left) === brandKey(right) && brandKey(left).length >= 3);
}

export function rankMedicineCandidates(input: {
  spoken: string;
  catalogChoice?: string;
  candidates: string[];
}): RankedMedicine {
  const spoken = input.spoken.trim();
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const candidate of input.candidates) {
    const name = candidate.trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    unique.push(name);
  }

  const choice = input.catalogChoice?.trim() ?? "";
  if (choice) {
    const chosen = unique.find((name) => sameName(name, choice));
    if (chosen && strengthsCompatible(spoken || choice, chosen)) {
      return { name: chosen, matched: true, confidence: "high", alternatives: [] };
    }
  }

  const scored = unique
    .map((name) => ({
      name,
      score: similarity(spoken, name),
      strengthOk: strengthsCompatible(spoken, name),
    }))
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name));

  const close = scored.filter((item) => item.score >= 0.55 && item.strengthOk).slice(0, 3);
  const best = close[0];
  if (!best) {
    return { name: spoken, matched: false, confidence: "none", alternatives: [] };
  }
  const rivals = close.filter((item) => item.score >= 0.86);
  const spokenStrength = medicineStrength(spoken);
  const inventsStrength = !spokenStrength && Boolean(medicineStrength(best.name));
  if (best.score >= 0.86 && rivals.length === 1 && !inventsStrength) {
    return { name: best.name, matched: true, confidence: "high", alternatives: [] };
  }
  return {
    name: spoken,
    matched: false,
    confidence: "low",
    alternatives: close.map((item) => item.name),
  };
}

const SKIP_WORDS = new Set([
  "tablet",
  "tablets",
  "capsule",
  "syrup",
  "medicine",
  "morning",
  "afternoon",
  "night",
  "days",
  "pain",
  "fever",
  "with",
  "dose",
  "after",
  "before",
  "food",
  "patient",
  "doctor",
  "since",
  "have",
  "been",
  "from",
  "this",
  "that",
  "said",
  "give",
  "take",
  "today",
  "headache",
  "hello",
  "sir",
  "outpatient",
  "visit",
  "complaint",
  "infection",
  "throat",
  "cough",
  "cold",
  "body",
  "water",
]);

/** A doctor's own medicine, only when the spoken name is close. A greeting or a different drug is not offered. */
export function suggestionNames(spoken: string, candidates: string[]) {
  const ranked = rankMedicineCandidates({ spoken, candidates });
  if (ranked.confidence === "high") return [ranked.name];
  return ranked.alternatives.filter((name) => similarity(spoken, name) >= 0.86).slice(0, 4);
}

/** Drop a medicine catalog the transcriber copied from its instructions. */
export function withoutPromptEcho(text: string) {
  return text
    .replace(/\boutpatient visit\.\s*keep every symptom[^.]*(?:\.|$)/gi, " ")
    .replace(/\boutpatient visit\.\s*medicines:\s*.+$/gim, " ")
    .replace(/\bmedicines:\s*(?:[^,.\n]+,\s*){2,}[^.\n]*/gi, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Pull a spoken medicine out of one line, including a misheard brand on its own. */
export function medicinePhrases(text: string) {
  const phrases: string[] = [];
  const cue = /(?:மருந்து|மாத்திரை|tablet|tab|capsule|syrup|medicine)\s+([^\n,.]{2,48})/gi;
  for (const match of text.matchAll(cue)) {
    const phrase = match[1]?.trim();
    if (phrase) phrases.push(phrase);
  }
  for (const word of text.split(/[^\p{L}\p{N}]+/u)) {
    const spoken = (/[\u0B80-\u0BFF]/.test(word) ? transliterateTamil(word) : word).toLowerCase();
    if (spoken.length < 4 || SKIP_WORDS.has(spoken) || SKIP_WORDS.has(word.toLowerCase()) || /^\d+$/.test(spoken)) continue;
    phrases.push(word);
  }
  return [...new Set(phrases)].slice(0, 4);
}

/** Short Latin prefixes used to look up the catalog. */
export function medicineSearchTokens(spoken: string) {
  const latin = latinOf(spoken);
  const words = latin.split(/[^a-z0-9]+/).filter((word) => word.length >= 3 && !/^\d+$/.test(word));
  return [...new Set(words.map((word) => word.slice(0, 4)))].slice(0, 2);
}
