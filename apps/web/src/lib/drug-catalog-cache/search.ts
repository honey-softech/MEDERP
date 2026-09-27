export type CatalogSearchFields = {
  id: string;
  name: string;
  salt: string | null;
  pack: string | null;
  manufacturer: string | null;
  searchText: string;
};

export type CachedDrug = CatalogSearchFields & {
  nameLower: string;
  tokens: string[];
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

/** Same order as /api/medicines/suggest: name prefix first, then name A–Z. */
export function rankCatalogMatches<T extends { name: string }>(items: T[], query: string, limit: number) {
  const q = query.trim().toLowerCase();
  const prefix: T[] = [];
  const rest: T[] = [];
  for (const item of items) {
    if (item.name.toLowerCase().startsWith(q)) prefix.push(item);
    else rest.push(item);
  }
  const byName = (a: T, b: T) => a.name.localeCompare(b.name);
  prefix.sort(byName);
  rest.sort(byName);
  return [...prefix, ...rest].slice(0, limit);
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
  };
}
