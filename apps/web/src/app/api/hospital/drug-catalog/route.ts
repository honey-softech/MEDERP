import { NextResponse } from "next/server";
import {
  catalogImportStatus,
  importDrugCatalog,
  resolveCatalogSource,
  syncDrugManufacturers,
} from "@/lib/drug-catalog-import";
import { forbidUnless, requireHospitalActor } from "@/lib/front-desk";
import { prisma } from "@/lib/prisma";

export const maxDuration = 300;

export async function GET() {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  const denied = forbidUnless(scoped.user.role, ["SUPER_ADMIN"]);
  if (denied) return denied;

  const catalogSize = await prisma.drugCatalog.count();
  return NextResponse.json({ catalogSize, job: catalogImportStatus() });
}

export async function POST() {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  const denied = forbidUnless(scoped.user.role, ["SUPER_ADMIN"]);
  if (denied) return denied;

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

  return NextResponse.json({ ok: true, started: true, running: true, source: source.startsWith("http") ? source : "local file" });
}
