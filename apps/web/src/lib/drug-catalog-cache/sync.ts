import {
  clearCachedDrugs,
  deleteCachedDrugs,
  deleteDrugCatalogDb,
  putCachedDrugs,
  readCacheMeta,
  writeCacheMeta,
} from "./db";
import { isMedErpMobileApp } from "./platform";
import { parseCatalogLine, toCachedDrug, type CatalogSearchFields } from "./search";

const RECHECK_MS = 6 * 60 * 60 * 1000;
const FOCUS_GAP_MS = 60_000;
const PUT_BATCH = 2_000;

type RemoteMeta = {
  version?: number;
  brands?: unknown;
};

type DeltaItem = CatalogSearchFields & { deleted?: boolean };

type DeltaResponse = {
  version?: number;
  reset?: boolean;
  items?: DeltaItem[];
};

let inflight: Promise<void> | null = null;
let lastCheck = 0;
let listenersBound = false;
let disabled = false;

function isQuotaError(error: unknown) {
  if (error instanceof DOMException) {
    return error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED";
  }
  return error instanceof Error && /quota/i.test(`${error.name} ${error.message}`);
}

function brandList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((brand): brand is string => typeof brand === "string" && brand.trim().length > 0);
}

function sameBrands(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  const a = [...left].map((brand) => brand.toLowerCase()).sort();
  const b = [...right].map((brand) => brand.toLowerCase()).sort();
  return a.every((brand, index) => brand === b[index]);
}

async function flushPuts(rows: ReturnType<typeof toCachedDrug>[]) {
  for (let index = 0; index < rows.length; index += PUT_BATCH) {
    await putCachedDrugs(rows.slice(index, index + PUT_BATCH));
  }
}

async function downloadSnapshot(fallbackVersion: number, brands: string[]) {
  await clearCachedDrugs();
  await writeCacheMeta({
    key: "catalog",
    localVersion: 0,
    ready: false,
    syncedAt: Date.now(),
    brands,
  });

  const response = await fetch("/api/drug-catalog/snapshot", { cache: "no-store" });
  if (!response.ok || !response.body) {
    throw new Error("Catalog snapshot failed");
  }

  const header = response.headers.get("X-Catalog-Version");
  const headerVersion = header == null || header.trim() === "" ? Number.NaN : Number(header);
  const version = Number.isFinite(headerVersion) ? headerVersion : fallbackVersion;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let batch: ReturnType<typeof toCachedDrug>[] = [];

  const flush = async () => {
    if (batch.length === 0) return;
    const chunk = batch;
    batch = [];
    await putCachedDrugs(chunk);
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split("\n");
    buffer = done ? "" : (lines.pop() ?? "");
    for (const line of lines) {
      const row = parseCatalogLine(line);
      if (!row) continue;
      batch.push(toCachedDrug(row));
      if (batch.length >= PUT_BATCH) await flush();
    }
    if (done) break;
  }

  if (buffer.trim()) {
    const row = parseCatalogLine(buffer);
    if (row) batch.push(toCachedDrug(row));
  }
  await flush();
  await writeCacheMeta({
    key: "catalog",
    localVersion: version,
    ready: true,
    syncedAt: Date.now(),
    brands,
  });
}

async function applyDelta(items: DeltaItem[], version: number, brands: string[]) {
  const upserts = [];
  const removed: string[] = [];
  for (const item of items) {
    if (item.deleted) removed.push(item.id);
    else upserts.push(toCachedDrug(item));
  }
  await flushPuts(upserts);
  await deleteCachedDrugs(removed);
  await writeCacheMeta({
    key: "catalog",
    localVersion: version,
    ready: true,
    syncedAt: Date.now(),
    brands,
  });
}

async function syncOnce() {
  const response = await fetch("/api/drug-catalog/meta", { cache: "no-store" });
  if (!response.ok) return;

  const remote = (await response.json()) as RemoteMeta;
  const version = Number(remote.version ?? 0);
  const brands = brandList(remote.brands);
  const local = await readCacheMeta().catch(() => null);

  if (!local?.ready) {
    await downloadSnapshot(Number.isFinite(version) ? version : 0, brands);
  } else if (Number.isFinite(version) && version > local.localVersion) {
    const deltaResponse = await fetch(`/api/drug-catalog/sync?since=${local.localVersion}`, { cache: "no-store" });
    if (!deltaResponse.ok) return;
    const delta = (await deltaResponse.json()) as DeltaResponse;
    const nextVersion = Number(delta.version ?? version);
    if (delta.reset) {
      await downloadSnapshot(nextVersion, brands);
    } else {
      await applyDelta(Array.isArray(delta.items) ? delta.items : [], nextVersion, brands);
    }
  } else if (local && !sameBrands(local.brands, brands)) {
    await writeCacheMeta({ ...local, brands, syncedAt: Date.now() });
  }

  lastCheck = Date.now();
}

function bindListeners() {
  if (listenersBound || typeof window === "undefined") return;
  listenersBound = true;

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    if (Date.now() - lastCheck < FOCUS_GAP_MS) return;
    void ensureDrugCatalogCache();
  });

  window.setInterval(() => {
    if (Date.now() - lastCheck < RECHECK_MS) return;
    void ensureDrugCatalogCache();
  }, RECHECK_MS);
}

/** Download or refresh the on-device catalog. Failures leave search on the API. */
export function ensureDrugCatalogCache() {
  if (typeof window === "undefined" || typeof indexedDB === "undefined" || disabled || !isMedErpMobileApp()) {
    return Promise.resolve();
  }
  bindListeners();
  if (!inflight) {
    inflight = syncOnce()
      .catch(async (error: unknown) => {
        if (!isQuotaError(error)) return;
        disabled = true;
        await deleteDrugCatalogDb().catch(() => undefined);
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}
