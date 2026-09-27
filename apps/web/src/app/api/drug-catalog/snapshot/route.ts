import { Readable } from "node:stream";
import { createGzip } from "node:zlib";
import type { ReadableStream as NodeWebReadableStream } from "node:stream/web";
import { NextRequest } from "next/server";
import { getCatalogMeta } from "@/lib/drug-catalog-sync";
import { requireHospitalActor } from "@/lib/front-desk";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const runtime = "nodejs";

const PAGE = 2_000;

type SnapshotRow = {
  id: string;
  name: string;
  salt: string | null;
  pack: string | null;
  manufacturer: string | null;
  searchText: string;
  medicineCount: number;
};

type CatalogPageRow = {
  id: string;
  name: string;
  saltComposition: string | null;
  packSize: string | null;
  manufacturer: string | null;
  searchText: string;
};

function gzipStream(stream: ReadableStream<Uint8Array>) {
  const gzip = createGzip();
  const zipped = Readable.fromWeb(stream as NodeWebReadableStream<Uint8Array>).pipe(gzip);
  return Readable.toWeb(zipped) as ReadableStream<Uint8Array>;
}

export async function GET(request: NextRequest) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;

  const meta = await getCatalogMeta(prisma);
  const version = meta.version;
  const manufacturers = await prisma.drugManufacturer.findMany({
    select: { name: true, medicineCount: true },
  });
  const medicineCounts = new Map(manufacturers.map((row) => [row.name, row.medicineCount]));
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        let cursor: string | null = null;
        for (;;) {
          const rows: CatalogPageRow[] = await prisma.drugCatalog.findMany({
            where: {
              isDiscontinued: false,
              syncVersion: { gt: 0, lte: version },
              ...(cursor ? { id: { gt: cursor } } : {}),
            },
            orderBy: { id: "asc" },
            take: PAGE,
            select: {
              id: true,
              name: true,
              saltComposition: true,
              packSize: true,
              manufacturer: true,
              searchText: true,
            },
          });
          if (rows.length === 0) break;

          let chunk = "";
          for (const row of rows) {
            const line: SnapshotRow = {
              id: row.id,
              name: row.name,
              salt: row.saltComposition,
              pack: row.packSize,
              manufacturer: row.manufacturer,
              searchText: row.searchText,
              medicineCount: row.manufacturer ? (medicineCounts.get(row.manufacturer) ?? 0) : 0,
            };
            chunk += `${JSON.stringify(line)}\n`;
          }
          controller.enqueue(encoder.encode(chunk));
          cursor = rows[rows.length - 1]?.id ?? cursor;
          if (rows.length < PAGE) break;
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  const accept = request.headers.get("accept-encoding") ?? "";
  const canGzip = accept.includes("gzip");
  const body = canGzip ? gzipStream(stream) : stream;

  return new Response(body, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Catalog-Version": String(version),
      ...(canGzip ? { "Content-Encoding": "gzip" } : {}),
    },
  });
}
