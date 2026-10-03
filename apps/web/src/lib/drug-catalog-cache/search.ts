export type CatalogSearchFields = {
  id: string;
  name: string;
  salt: string | null;
  pack: string | null;
  manufacturer: string | null;
  searchText: string;
  medicineCount?: number;
};

export type CachedDrug = CatalogSearchFields & {
  nameLower: string;
  tokens: string[];
  medicineCount: number;
};

export type DrugSuggestHit = {
  id: string;
  name: string;
  salt: string | null;
  pack: string | null;
  manufacturer: string | null;
};

export type ParsedDrugQuery = {
  /** Free-text terms after stripping strength / form tokens. */
  text: string;
  /** Original trimmed query (lowercased). */
  raw: string;
  strength: string | null;
  form: string | null;
};

const DOSAGE_FORMS = [
  "tablet",
  "tablets",
  "tab",
  "tabs",
  "capsule",
  "capsules",
  "cap",
  "caps",
  "syrup",
  "suspension",
  "injection",
  "inj",
  "cream",
  "ointment",
  "gel",
  "drops",
  "drop",
  "inhaler",
  "powder",
  "sachet",
  "solution",
  "infusion",
  "lotion",
  "spray",
] as const;

const FORM_ALIASES: Record<string, string> = {
  tablet: "tablet",
  tablets: "tablet",
  tab: "tablet",
  tabs: "tablet",
  capsule: "capsule",
  capsules: "capsule",
  cap: "capsule",
  caps: "capsule",
  syrup: "syrup",
  suspension: "suspension",
  injection: "injection",
  inj: "injection",
  cream: "cream",
  ointment: "ointment",
  gel: "gel",
  drops: "drops",
  drop: "drops",
  inhaler: "inhaler",
  powder: "powder",
  sachet: "sachet",
  solution: "solution",
  infusion: "infusion",
  lotion: "lotion",
  spray: "spray",
};

export const DRUG_FORM_FILTERS = [
  "tablet",
  "capsule",
  "syrup",
  "suspension",
  "injection",
  "cream",
  "ointment",
  "gel",
  "drops",
  "inhaler",
  "powder",
  "sachet",
] as const;

/** Words used for local prefix search. Mid-word queries fall through to the API. */
export function catalogTokens(searchText: string) {
  const parts = searchText
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2);
  return [...new Set(parts)];
}

export function toCachedDrug(row: CatalogSearchFields): CachedDrug {
  const searchText = (row.searchText || row.name).toLowerCase().replace(/\s+/g, " ").trim();
  return {
    id: row.id,
    name: row.name,
    salt: row.salt,
    pack: row.pack,
    manufacturer: row.manufacturer,
    searchText,
    nameLower: row.name.trim().toLowerCase(),
    tokens: catalogTokens(searchText),
    medicineCount: row.medicineCount ?? 0,
  };
}

export function toSuggestHit(drug: CatalogSearchFields): DrugSuggestHit {
  return {
    id: drug.id,
    name: drug.name,
    salt: drug.salt,
    pack: drug.pack,
    manufacturer: drug.manufacturer,
  };
}

export function matchesBrand(manufacturer: string | null, brands: ReadonlySet<string> | null) {
  if (!brands) return true;
  if (!manufacturer) return false;
  return brands.has(manufacturer.toLowerCase());
}

function normalizeQuery(query: string) {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizeForm(form: string | null | undefined) {
  if (!form) return null;
  const key = form.trim().toLowerCase();
  return FORM_ALIASES[key] ?? (key.length >= 2 ? key : null);
}

/** Pull strength (e.g. 500mg / 500) and dosage form out of a free-text query. */
export function parseDrugQuery(query: string): ParsedDrugQuery {
  const raw = normalizeQuery(query);
  if (!raw) return { text: "", raw: "", strength: null, form: null };

  let rest = raw;
  let strength: string | null = null;
  let form: string | null = null;

  const strengthWithUnit = rest.match(/\b(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|iu|%)\b/i);
  if (strengthWithUnit) {
    strength = `${strengthWithUnit[1]}${(strengthWithUnit[2] ?? "").toLowerCase()}`;
    rest = `${rest.slice(0, strengthWithUnit.index)} ${rest.slice((strengthWithUnit.index ?? 0) + strengthWithUnit[0].length)}`;
  }

  const formPattern = new RegExp(`\\b(${DOSAGE_FORMS.join("|")})\\b`, "i");
  const formMatch = rest.match(formPattern);
  if (formMatch) {
    form = normalizeForm(formMatch[1]);
    rest = `${rest.slice(0, formMatch.index)} ${rest.slice((formMatch.index ?? 0) + formMatch[0].length)}`;
  }

  // Bare dose like "Paracetamol 500" / "Paracetamol 500 tablet" (unit omitted).
  // Only whole numeric tokens — avoids treating "B12" as strength.
  if (!strength) {
    const tokens = rest.split(/\s+/).filter(Boolean);
    for (let i = tokens.length - 1; i >= 0; i -= 1) {
      if (/^\d+(?:\.\d+)?$/.test(tokens[i]!)) {
        strength = `${tokens[i]}mg`;
        tokens.splice(i, 1);
        rest = tokens.join(" ");
        break;
      }
    }
  }

  const text = rest.replace(/\s+/g, " ").trim();
  return { text: text || raw, raw, strength, form };
}

function drugHaystack(drug: RankableDrug) {
  return [drug.name, drug.salt, drug.pack].filter(Boolean).join(" ").toLowerCase();
}

export function drugMatchesForm(drug: RankableDrug, form: string | null | undefined) {
  const normalized = normalizeForm(form);
  if (!normalized) return true;
  const hay = drugHaystack(drug);
  if (normalized === "tablet") return /\b(tablet|tablets|tab|tabs)\b/.test(hay);
  if (normalized === "capsule") return /\b(capsule|capsules|cap|caps)\b/.test(hay);
  if (normalized === "injection") return /\b(injection|inj|injectable|vial|ampoule|ampule)\b/.test(hay);
  if (normalized === "drops") return /\b(drop|drops)\b/.test(hay);
  return hay.includes(normalized);
}

export function drugMatchesStrength(drug: RankableDrug, strength: string | null | undefined) {
  if (!strength) return true;
  const compact = strength.toLowerCase().replace(/\s+/g, "");
  const number = compact.match(/^(\d+(?:\.\d+)?)/)?.[1];
  if (!number) return true;
  const hay = drugHaystack(drug);
  const hayCompact = hay.replace(/\s+/g, "");
  if (hayCompact.includes(compact)) return true;
  // "500 mg" / "500mg" in name/salt/pack
  if (new RegExp(`\\b${number}\\s*(mg|mcg|g|ml|iu|%)\\b`, "i").test(hay)) return true;
  // Brand names often encode dose without a unit ("Dolo 650").
  return new RegExp(`\\b${number}\\b`).test(hay);
}

type RankableDrug = {
  name: string;
  salt?: string | null;
  pack?: string | null;
  manufacturer: string | null;
  medicineCount?: number;
};

/** Strip strength / form suffixes so "Paracetamol 650mg" compares as "paracetamol". */
export function saltBase(saltPart: string) {
  return saltPart
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\d+([./]\d+)?\s*(mg|mcg|g|ml|%|iu|units?)?\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isCombinationSalt(salt: string | null | undefined) {
  if (!salt) return false;
  return /\+|\/|,|\band\b/i.test(salt);
}

/**
 * Lower is better.
 * 0 = sole composition is exactly the query (Paracetamol)
 * 1 = sole composition starts with / is the query base
 * 2 = brand name starts with the query
 * 3 = primary salt (before +) is the query; may still be a combo with query first
 * 4 = name contains query as a word
 * 5 = salt contains query but is a combo (Aceclofenac + Paracetamol) — keep at bottom
 * 9 = weak / other match
 */
export function compositionMatchRank(drug: RankableDrug, query: string) {
  const parsed = parseDrugQuery(query);
  const q = parsed.text || normalizeQuery(query);
  if (q.length < 2) return 9;

  const name = drug.name.toLowerCase().replace(/\s+/g, " ").trim();
  const salt = (drug.salt ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  const combo = isCombinationSalt(salt);
  const soleBase = saltBase(salt);
  const primary = saltBase(salt.split(/\s*[+/]\s*|\s*,\s*|\s+and\s+/i)[0] ?? salt);

  if (salt && !combo && (salt === q || soleBase === q)) return 0;
  if (salt && !combo && (salt.startsWith(q) || soleBase.startsWith(q) || soleBase.split(" ").includes(q)))
    return 1;
  if (name.startsWith(q)) return 2;
  if (primary === q || primary.startsWith(q)) return combo ? 3 : 1;

  const nameWords = name.split(/[^a-z0-9]+/).filter(Boolean);
  if (nameWords.some((word) => word === q || word.startsWith(q))) return 4;

  if (salt.includes(q) && combo) return 5;
  if (salt.includes(q) || name.includes(q)) return 6;
  return 9;
}

function strengthBonus(drug: RankableDrug, strength: string | null) {
  if (!strength) return 0;
  return drugMatchesStrength(drug, strength) ? 0 : 2;
}

function formBonus(drug: RankableDrug, form: string | null) {
  if (!form) return 0;
  return drugMatchesForm(drug, form) ? 0 : 2;
}

function preferredPriority(
  manufacturer: string | null,
  preferredManufacturers: readonly string[],
) {
  if (!manufacturer || preferredManufacturers.length === 0) return null;
  const idx = preferredManufacturers.findIndex((name) => name.toLowerCase() === manufacturer.toLowerCase());
  return idx >= 0 ? idx : null;
}

function compareSuggestions(query: string, preferredManufacturers: readonly string[] = []) {
  const parsed = parseDrugQuery(query);
  const q = parsed.text || normalizeQuery(query);
  return (a: RankableDrug, b: RankableDrug) => {
    const byComposition = compositionMatchRank(a, query) - compositionMatchRank(b, query);
    if (byComposition !== 0) return byComposition;

    const byStrength = strengthBonus(a, parsed.strength) - strengthBonus(b, parsed.strength);
    if (byStrength !== 0) return byStrength;

    const byForm = formBonus(a, parsed.form) - formBonus(b, parsed.form);
    if (byForm !== 0) return byForm;

    const aPreferred = preferredPriority(a.manufacturer, preferredManufacturers);
    const bPreferred = preferredPriority(b.manufacturer, preferredManufacturers);
    if (aPreferred != null || bPreferred != null) {
      if (aPreferred == null) return 1;
      if (bPreferred == null) return -1;
      if (aPreferred !== bPreferred) return aPreferred - bPreferred;
    }

    const aPrefix = a.name.toLowerCase().startsWith(q) ? 0 : 1;
    const bPrefix = b.name.toLowerCase().startsWith(q) ? 0 : 1;
    if (aPrefix !== bPrefix) return aPrefix - bPrefix;
    const byCount = (b.medicineCount ?? 0) - (a.medicineCount ?? 0);
    if (byCount !== 0) return byCount;
    return a.name.localeCompare(b.name);
  };
}

/**
 * Admin-selected brands first. Other brands follow.
 * Within each group: sole composition / name match first, combinations last, then popularity.
 */
export function rankDrugSuggestions<T extends RankableDrug>(
  items: T[],
  query: string,
  preferredManufacturers: readonly string[],
  limit: number,
) {
  const sectioned = sectionDrugSuggestions(items, query, preferredManufacturers, limit);
  return sectioned.items;
}

/** Split preferred vs other manufacturers, then rank within each group. */
export function sectionDrugSuggestions<T extends RankableDrug>(
  items: T[],
  query: string,
  preferredManufacturers: readonly string[],
  limit: number,
) {
  const preferred = new Set(preferredManufacturers.map((name) => name.toLowerCase()));
  const preferredHits: T[] = [];
  const otherHits: T[] = [];
  for (const item of items) {
    const manufacturer = item.manufacturer?.toLowerCase() ?? "";
    if (preferred.size > 0 && preferred.has(manufacturer)) preferredHits.push(item);
    else otherHits.push(item);
  }

  const compare = compareSuggestions(query, preferredManufacturers);
  preferredHits.sort(compare);
  otherHits.sort(compare);

  if (preferredHits.length === 0) {
    const other = otherHits.slice(0, limit);
    return { preferred: [] as T[], other, items: other };
  }
  if (otherHits.length === 0) {
    const preferredSlice = preferredHits.slice(0, limit);
    return { preferred: preferredSlice, other: [] as T[], items: preferredSlice };
  }

  const otherSlots = Math.min(otherHits.length, Math.max(1, Math.floor(limit / 4)));
  const preferredSlots = Math.min(preferredHits.length, limit - otherSlots);
  const otherTake = Math.min(otherHits.length, limit - preferredSlots);
  const preferredSlice = preferredHits.slice(0, preferredSlots);
  const otherSlice = otherHits.slice(0, otherTake);
  return {
    preferred: preferredSlice,
    other: otherSlice,
    items: [...preferredSlice, ...otherSlice],
  };
}

export function parseCatalogLine(line: string): CatalogSearchFields | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const parsed = JSON.parse(trimmed) as Partial<CatalogSearchFields>;
  if (!parsed || typeof parsed.id !== "string" || typeof parsed.name !== "string") {
    throw new Error("Invalid catalog row");
  }
  return {
    id: parsed.id,
    name: parsed.name,
    salt: typeof parsed.salt === "string" ? parsed.salt : null,
    pack: typeof parsed.pack === "string" ? parsed.pack : null,
    manufacturer: typeof parsed.manufacturer === "string" ? parsed.manufacturer : null,
    searchText: typeof parsed.searchText === "string" ? parsed.searchText : parsed.name,
    medicineCount: typeof parsed.medicineCount === "number" ? parsed.medicineCount : 0,
  };
}
