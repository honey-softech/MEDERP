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

/** Words used for local prefix search. Mid-word queries fall through to the API. */
export function catalogTokens(searchText: string) {
  const parts = searchText.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length >= 2);
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

type RankableDrug = {
  name: string;
  salt?: string | null;
  manufacturer: string | null;
  medicineCount?: number;
};

function normalizeQuery(query: string) {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

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
  const q = normalizeQuery(query);
  if (q.length < 2) return 9;

  const name = drug.name.toLowerCase().replace(/\s+/g, " ").trim();
  const salt = (drug.salt ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  const combo = isCombinationSalt(salt);
  const soleBase = saltBase(salt);
  const primary = saltBase(salt.split(/\s*[+/]\s*|\s*,\s*|\s+and\s+/i)[0] ?? salt);

  if (salt && !combo && (salt === q || soleBase === q)) return 0;
  if (salt && !combo && (salt.startsWith(q) || soleBase.startsWith(q) || soleBase.split(" ").includes(q))) return 1;
  if (name.startsWith(q)) return 2;
  if (primary === q || primary.startsWith(q)) return combo ? 3 : 1;

  const nameWords = name.split(/[^a-z0-9]+/).filter(Boolean);
  if (nameWords.some((word) => word === q || word.startsWith(q))) return 4;

  if (salt.includes(q) && combo) return 5;
  if (salt.includes(q) || name.includes(q)) return 6;
  return 9;
}

function compareSuggestions(query: string) {
  const q = normalizeQuery(query);
  return (a: RankableDrug, b: RankableDrug) => {
    const byComposition = compositionMatchRank(a, q) - compositionMatchRank(b, q);
    if (byComposition !== 0) return byComposition;
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
  const preferred = new Set(preferredManufacturers.map((name) => name.toLowerCase()));
  const preferredHits: T[] = [];
  const otherHits: T[] = [];
  for (const item of items) {
    const manufacturer = item.manufacturer?.toLowerCase() ?? "";
    if (preferred.size > 0 && preferred.has(manufacturer)) preferredHits.push(item);
    else otherHits.push(item);
  }

  const compare = compareSuggestions(query);
  preferredHits.sort(compare);
  otherHits.sort(compare);

  if (preferredHits.length === 0) return otherHits.slice(0, limit);
  if (otherHits.length === 0) return preferredHits.slice(0, limit);

  const otherSlots = Math.min(otherHits.length, Math.max(1, Math.floor(limit / 4)));
  const preferredSlots = Math.min(preferredHits.length, limit - otherSlots);
  const otherTake = Math.min(otherHits.length, limit - preferredSlots);
  return [...preferredHits.slice(0, preferredSlots), ...otherHits.slice(0, otherTake)];
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
