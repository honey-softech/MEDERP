import { NextResponse } from "next/server";
import { preferredManufacturerNames } from "@/lib/drug-brands";
import { getCatalogMeta } from "@/lib/drug-catalog-sync";
import { requireHospitalActor } from "@/lib/front-desk";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;

  const [meta, count, brands] = await Promise.all([
    getCatalogMeta(prisma),
    prisma.drugCatalog.count({ where: { isDiscontinued: false, syncVersion: { gt: 0 } } }),
    preferredManufacturerNames(scoped.user.hospitalId),
  ]);

  return NextResponse.json({
    version: meta.version,
    count,
    brands,
  });
}
