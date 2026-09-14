import { NextResponse } from "next/server";
import {
  catalogImportStatus,
  importDrugCatalog,
  resolveCatalogSource,
  syncDrugManufacturers,
} from "@/lib/drug-catalog-import";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const maxDuration = 300;

function canManageCatalog(role: string) {
  return role === "SOFTWARE_ADMIN" || role === "HELPDESK";
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !canManageCatalog(user.role)) {
    return NextResponse.json({ error: "Software admin or helpdesk access required." }, { status: 403 });
  }

  const catalogSize = await prisma.drugCatalog.count();
  return NextResponse.json({ catalogSize, job: catalogImportStatus() });
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user || !canManageCatalog(user.role)) {
    return NextResponse.json({ error: "Software admin or helpdesk access required." }, { status: 403 });
  }

  const current = catalogImportStatus();
  if (current?.running) {
    return NextResponse.json({ ok: true, started: false, running: true, job: current });
  }

  const catalogSize = await prisma.drugCatalog.count();
  if (catalogSize > 0) {
    return NextResponse.json({ ok: true, started: false, alreadyLoaded: true, catalogSize });
  }

  const source = resolveCatalogSource();
  void importDrugCatalog(prisma, source)
    .then(async () => {
      await syncDrugManufacturers(prisma);
    })
    .catch((error) => {
      console.error("Drug catalog import failed:", error);
    });

  return NextResponse.json({
    ok: true,
    started: true,
    running: true,
    source: source.startsWith("http") ? source : "local file",
  });
}
