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
  manufacturer: string | null;
  medicineCount?: number;
};

function compareSuggestions(query: string) {
  const q = query.trim().toLowerCase();
  return (a: RankableDrug, b: RankableDrug) => {
    const byCount = (b.medicineCount ?? 0) - (a.medicineCount ?? 0);
    if (byCount !== 0) return byCount;
    const aPrefix = a.name.toLowerCase().startsWith(q) ? 0 : 1;
    const bPrefix = b.name.toLowerCase().startsWith(q) ? 0 : 1;
    if (aPrefix !== bPrefix) return aPrefix - bPrefix;
    return a.name.localeCompare(b.name);
  };
}

/**
 * Admin-selected brands first. Other brands follow, largest catalogs first.
 * When both groups match, a few other-brand rows stay at the bottom of the list.
 * When the selected brands have no match, the list is filled from other brands.
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
