/**
 * Import Indian medicine CSV into DrugCatalog (slim fields only).
 *
 * Usage:
 *   npx tsx prisma/import-drug-catalog.ts [path-to-csv]
 *
 * Default path:
 *   C:\Users\Dhanush\Downloads\Indian-Medicine-Dataset-main\...\updated_indian_medicine_data.csv
 */
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const DEFAULT_CSV =
  "C:\\Users\\Dhanush\\Downloads\\Indian-Medicine-Dataset-main\\Indian-Medicine-Dataset-main\\DATA\\updated_indian_medicine_data.csv";

const BATCH = 2_000;
const prisma = new PrismaClient();

function cuidLike() {
  return `c${randomBytes(12).toString("hex")}`;
}

/** Minimal RFC4180-ish CSV row parser (handles quoted commas/newlines within fields poorly — rows are single-line). */
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

async function main() {
  const csvPath = process.argv[2] || DEFAULT_CSV;
  console.log(`Importing from:\n  ${csvPath}`);

  const rl = createInterface({
    input: createReadStream(csvPath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  let headers: string[] | null = null;
  let batch: Row[] = [];
  let inserted = 0;
  let skipped = 0;
  let lineNo = 0;

  async function flush() {
    if (batch.length === 0) return;
    const chunk = batch;
    batch = [];
    await prisma.drugCatalog.createMany({ data: chunk, skipDuplicates: true });
    inserted += chunk.length;
    process.stdout.write(`\r  imported ~${inserted.toLocaleString()} (skipped discontinued/invalid: ${skipped.toLocaleString()})`);
  }

  for await (const line of rl) {
    lineNo++;
    if (!headers) {
      headers = parseCsvLine(line).map((h) => h.trim());
      continue;
    }
    if (!line.trim()) continue;

    const cols = parseCsvLine(line);
    const get = (key: string) => {
      const idx = headers!.indexOf(key);
      return idx >= 0 ? (cols[idx] ?? "").trim() : "";
    };

    const sourceId = Number(get("id"));
    const name = get("name");
    if (!Number.isFinite(sourceId) || !name) {
      skipped++;
      continue;
    }

    const isDiscontinued = truthyDiscontinued(get("Is_discontinued"));
    if (isDiscontinued) {
      skipped++;
      continue;
    }

    const manufacturer = get("manufacturer_name") || null;
    const packSize = get("pack_size_label") || null;
    const saltComposition = get("salt_composition") || null;
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
  console.log(`\nDone. Rows processed: ${lineNo - 1}. Catalog size: ${await prisma.drugCatalog.count()}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
