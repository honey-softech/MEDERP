import { createReadStream, existsSync } from "node:fs";
import { createInterface } from "node:readline";
import { randomBytes } from "node:crypto";
import { Readable } from "node:stream";
import type { ReadableStream as NodeWebReadableStream } from "node:stream/web";
import type { PrismaClient } from "@prisma/client";

export const DEFAULT_LOCAL_CSV =
  "C:\\Users\\Dhanush\\Downloads\\Indian-Medicine-Dataset-main\\Indian-Medicine-Dataset-main\\DATA\\updated_indian_medicine_data.csv";

export const DEFAULT_CSV_URL =
  process.env.DRUG_CATALOG_CSV_URL ||
  "https://raw.githubusercontent.com/junioralive/Indian-Medicine-Dataset/main/DATA/indian_medicine_data.csv";

const BATCH = 2_000;

type Row = {
  id: string;
  sourceId: number;
  name: string;
  manufacturer: string | null;
  packSize: string | null;
  saltComposition: string | null;
  type: string | null;
  searchText: string;
  isDiscontinued: boolean;
};

export type CatalogImportResult = {
  processed: number;
  inserted: number;
  skipped: number;
  catalogSize: number;
  source: string;
};

type ImportJob = {
  running: boolean;
  startedAt: number;
  message: string;
  inserted: number;
  skipped: number;
  error: string | null;
};

let job: ImportJob | null = null;

export function catalogImportStatus(): ImportJob | null {
  return job;
}

function cuidLike() {
  return `c${randomBytes(12).toString("hex")}`;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function truthyDiscontinued(value: string) {
  const v = value.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

function col(headers: string[], cols: string[], ...names: string[]) {
  const lower = headers.map((h) => h.trim().toLowerCase());
  for (const name of names) {
    const idx = lower.indexOf(name.toLowerCase());
    if (idx >= 0) return (cols[idx] ?? "").trim();
  }
  return "";
}

export function resolveCatalogSource(explicit?: string) {
  if (explicit) return explicit;
  if (existsSync(DEFAULT_LOCAL_CSV)) return DEFAULT_LOCAL_CSV;
  return DEFAULT_CSV_URL;
}

async function openCsv(source: string) {
  if (source.startsWith("http://") || source.startsWith("https://")) {
    console.log(`Downloading medicine catalog from ${source}`);
    const response = await fetch(source);
    if (!response.ok || !response.body) {
      throw new Error(`Could not download catalog CSV (${response.status})`);
    }
    return createInterface({
      input: Readable.fromWeb(response.body as NodeWebReadableStream),
      crlfDelay: Infinity,
    });
  }

  if (!existsSync(source)) {
    throw new Error(`Catalog CSV not found: ${source}`);
  }
  return createInterface({
    input: createReadStream(source, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
}

export async function importDrugCatalog(
  prisma: PrismaClient,
  source = resolveCatalogSource(),
): Promise<CatalogImportResult> {
  if (job?.running) {
    throw new Error("A catalog import is already running.");
  }

  job = {
    running: true,
    startedAt: Date.now(),
    message: "Starting import…",
    inserted: 0,
    skipped: 0,
    error: null,
  };

  try {
    const rl = await openCsv(source);
    let headers: string[] | null = null;
    let batch: Row[] = [];
    let inserted = 0;
    let skipped = 0;
    let processed = 0;

    async function flush() {
      if (batch.length === 0) return;
      const chunk = batch;
      batch = [];
      await prisma.drugCatalog.createMany({ data: chunk, skipDuplicates: true });
      inserted += chunk.length;
      job = job
        ? { ...job, inserted, skipped, message: `Imported ${inserted.toLocaleString()} medicines…` }
        : job;
      process.stdout.write(
        `\r  imported ~${inserted.toLocaleString()} (skipped discontinued/invalid: ${skipped.toLocaleString()})`,
      );
    }

    for await (const line of rl) {
      processed++;
      if (!headers) {
        headers = parseCsvLine(line).map((h) => h.trim());
        continue;
      }
      if (!line.trim()) continue;

      const cols = parseCsvLine(line);
      const get = (...names: string[]) => col(headers!, cols, ...names);

      const sourceId = Number(get("id"));
      const name = get("name");
      if (!Number.isFinite(sourceId) || !name) {
        skipped++;
        continue;
      }

      if (truthyDiscontinued(get("Is_discontinued", "is_discontinued"))) {
        skipped++;
        continue;
      }

      const manufacturer = get("manufacturer_name", "manufacturer") || null;
      const packSize = get("pack_size_label", "pack_size") || null;
      const saltComposition =
        get("salt_composition", "saltComposition") ||
        [get("short_composition1"), get("short_composition2")].filter(Boolean).join(" + ").replace(/\s+/g, " ").trim() ||
        null;
      const type = get("type") || null;
      const searchText = [name, saltComposition, manufacturer]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();

      batch.push({
        id: cuidLike(),
        sourceId,
        name,
        manufacturer,
        packSize,
        saltComposition,
        type,
        searchText,
        isDiscontinued: false,
      });

      if (batch.length >= BATCH) await flush();
    }

    await flush();
    const catalogSize = await prisma.drugCatalog.count();
    console.log(`\nDone. Rows processed: ${processed - 1}. Catalog size: ${catalogSize}`);
    job = {
      running: false,
      startedAt: job.startedAt,
      message: `Loaded ${catalogSize.toLocaleString()} medicines.`,
      inserted,
      skipped,
      error: null,
    };
    return { processed: processed - 1, inserted, skipped, catalogSize, source };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed";
    job = {
      running: false,
      startedAt: job?.startedAt ?? Date.now(),
      message,
      inserted: job?.inserted ?? 0,
      skipped: job?.skipped ?? 0,
      error: message,
    };
    throw error;
  }
}

export async function syncDrugManufacturers(prisma: PrismaClient) {
  await prisma.$executeRaw`
    INSERT INTO "DrugManufacturer" ("id", "name", "medicineCount", "searchText")
    SELECT
      'm' || md5("manufacturer"),
      "manufacturer",
      COUNT(*)::int,
      lower(regexp_replace(trim("manufacturer"), '\\s+', ' ', 'g'))
    FROM "DrugCatalog"
    WHERE "manufacturer" IS NOT NULL AND TRIM("manufacturer") <> ''
    GROUP BY "manufacturer"
    ON CONFLICT ("name") DO UPDATE SET
      "medicineCount" = EXCLUDED."medicineCount",
      "searchText" = EXCLUDED."searchText"
  `;
  return prisma.drugManufacturer.count();
}

export async function ensureDrugCatalog(prisma: PrismaClient) {
  const count = await prisma.drugCatalog.count();
  if (count > 0) {
    console.log(`DrugCatalog already loaded (${count.toLocaleString()} rows).`);
    return { skipped: true, catalogSize: count };
  }
  if (process.env.SKIP_DRUG_IMPORT === "1") {
    console.log("SKIP_DRUG_IMPORT=1 — leaving DrugCatalog empty.");
    return { skipped: true, catalogSize: 0 };
  }
  console.log("DrugCatalog is empty — importing medicine list…");
  const result = await importDrugCatalog(prisma);
  const manufacturers = await syncDrugManufacturers(prisma);
  console.log(`DrugManufacturer rows: ${manufacturers.toLocaleString()}`);
  return { skipped: false, catalogSize: result.catalogSize };
}
