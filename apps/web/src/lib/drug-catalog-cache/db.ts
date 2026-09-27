import { isMedErpMobileApp } from "./platform";
import {
  matchesBrand,
  rankCatalogMatches,
  toSuggestHit,
  type CachedDrug,
  type DrugSuggestHit,
} from "./search";

const DB_NAME = "mederp-drug-catalog";
const DB_VERSION = 1;
const DRUGS = "drugs";
const META = "meta";
const META_KEY = "catalog";

/** Stop a broad token scan so a 2-letter query stays fast. Selective queries finish before the cap. */
const TOKEN_CURSOR_CAP = 800;

export type CacheMeta = {
  key: typeof META_KEY;
  localVersion: number;
  ready: boolean;
  syncedAt: number;
  brands: string[];
};

let opening: Promise<IDBDatabase> | null = null;

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function txDone(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
}

export function resetDrugCatalogDbCache() {
  opening = null;
}

export function openDrugCatalogDb() {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }
  if (!opening) {
    opening = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(DRUGS)) {
          const drugs = db.createObjectStore(DRUGS, { keyPath: "id" });
          drugs.createIndex("nameLower", "nameLower", { unique: false });
          drugs.createIndex("tokens", "tokens", { unique: false, multiEntry: true });
          drugs.createIndex("manufacturer", "manufacturer", { unique: false });
        }
        if (!db.objectStoreNames.contains(META)) {
          db.createObjectStore(META, { keyPath: "key" });
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          opening = null;
        };
        resolve(db);
      };
      request.onerror = () => {
        opening = null;
        reject(request.error ?? new Error("Could not open the medicine catalog cache"));
      };
    });
  }
  return opening;
}

export async function deleteDrugCatalogDb() {
  if (opening) {
    const db = await opening.catch(() => null);
    db?.close();
  }
  opening = null;
  if (typeof indexedDB === "undefined") return;
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Could not delete the medicine catalog cache"));
    request.onblocked = () => resolve();
  });
}

export async function readCacheMeta(db = openDrugCatalogDb()) {
  const database = await db;
  const tx = database.transaction(META, "readonly");
  const row = await requestToPromise(tx.objectStore(META).get(META_KEY));
  await txDone(tx);
  return (row as CacheMeta | undefined) ?? null;
}

export async function writeCacheMeta(meta: CacheMeta) {
  const db = await openDrugCatalogDb();
  const tx = db.transaction(META, "readwrite");
  tx.objectStore(META).put(meta);
  await txDone(tx);
}

export async function clearCachedDrugs() {
  const db = await openDrugCatalogDb();
  const tx = db.transaction(DRUGS, "readwrite");
  tx.objectStore(DRUGS).clear();
  await txDone(tx);
}

export async function putCachedDrugs(rows: CachedDrug[]) {
  if (rows.length === 0) return;
  const db = await openDrugCatalogDb();
  const tx = db.transaction(DRUGS, "readwrite");
  const store = tx.objectStore(DRUGS);
  for (const row of rows) store.put(row);
  await txDone(tx);
}

export async function deleteCachedDrugs(ids: string[]) {
  if (ids.length === 0) return;
  const db = await openDrugCatalogDb();
  const tx = db.transaction(DRUGS, "readwrite");
  const store = tx.objectStore(DRUGS);
  for (const id of ids) store.delete(id);
  await txDone(tx);
}

function brandSet(brands: string[]) {
  if (brands.length === 0) return null;
  return new Set(brands.map((brand) => brand.toLowerCase()));
}

function walkCursor(
  source: IDBIndex,
  range: IDBKeyRange,
  onRow: (drug: CachedDrug) => "stop" | "continue",
) {
  return new Promise<void>((resolve, reject) => {
    const request = source.openCursor(range);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB cursor failed"));
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve();
        return;
      }
      if (onRow(cursor.value as CachedDrug) === "stop") {
        resolve();
        return;
      }
      cursor.continue();
    };
  });
}

async function collectNamePrefix(db: IDBDatabase, query: string, limit: number, brands: ReadonlySet<string> | null) {
  const hits: CachedDrug[] = [];
  const index = db.transaction(DRUGS, "readonly").objectStore(DRUGS).index("nameLower");
  await walkCursor(index, IDBKeyRange.bound(query, `${query}\uffff`), (drug) => {
    if (!matchesBrand(drug.manufacturer, brands)) return "continue";
    hits.push(drug);
    return hits.length >= limit ? "stop" : "continue";
  });
  return hits;
}

async function collectTokenPrefix(
  db: IDBDatabase,
  query: string,
  brands: ReadonlySet<string> | null,
  seen: Set<string>,
) {
  const hits: CachedDrug[] = [];
  let steps = 0;
  const index = db.transaction(DRUGS, "readonly").objectStore(DRUGS).index("tokens");
  await walkCursor(index, IDBKeyRange.bound(query, `${query}\uffff`), (drug) => {
    steps += 1;
    if (steps >= TOKEN_CURSOR_CAP) return "stop";
    if (seen.has(drug.id) || !matchesBrand(drug.manufacturer, brands)) return "continue";
    seen.add(drug.id);
    hits.push(drug);
    return "continue";
  });
  return hits;
}

/**
 * Local autosuggest. `null` means the cache is not ready (caller should use the API).
 * An empty array means the cache is ready but nothing matched a name/token prefix.
 */
export async function searchDrugCatalogCache(query: string, limit = 12): Promise<DrugSuggestHit[] | null> {
  if (typeof indexedDB === "undefined" || !isMedErpMobileApp()) return null;
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  try {
    const db = await openDrugCatalogDb();
    const meta = await readCacheMeta(Promise.resolve(db));
    if (!meta?.ready) return null;

    const brands = brandSet(meta.brands);
    const prefixHits = await collectNamePrefix(db, q, limit, brands);
    if (prefixHits.length >= limit) {
      return prefixHits.slice(0, limit).map(toSuggestHit);
    }

    const seen = new Set(prefixHits.map((drug) => drug.id));
    const tokenHits = await collectTokenPrefix(db, q, brands, seen);
    return rankCatalogMatches([...prefixHits, ...tokenHits], q, limit).map(toSuggestHit);
  } catch {
    return null;
  }
}
