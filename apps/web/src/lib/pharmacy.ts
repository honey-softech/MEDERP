import type { AppRole } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const PHARMACY_ROLES: AppRole[] = ["SUPER_ADMIN", "PHARMACIST"];

export type GrnLineInput = {
  /** Existing pharmacy item id, or omit when creating from catalog/manual */
  itemId?: string;
  name: string;
  genericName?: string | null;
  manufacturer?: string | null;
  unit?: string;
  barcode?: string | null;
  catalogDrugId?: string | null;
  batchNo: string;
  mfgDate?: string | null;
  expiryDate: string;
  quantity: number;
  purchaseRate: number;
  mrp: number;
  gstPercent?: number;
};

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function listPharmacyInventory(hospitalId: string) {
  const items = await prisma.pharmacyItem.findMany({
    where: { hospitalId, isActive: true },
    include: {
      batches: {
        where: { quantityAvailable: { gt: 0 } },
        orderBy: { expiryDate: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const now = Date.now();
  const in30 = now + 30 * 24 * 60 * 60 * 1000;
  const in90 = now + 90 * 24 * 60 * 60 * 1000;

  return items.map((item) => {
    const stock = item.batches.reduce((sum, batch) => sum + batch.quantityAvailable, 0);
    const nearestExpiry = item.batches[0]?.expiryDate ?? null;
    const nearExpiry = item.batches.some((batch) => {
      const t = batch.expiryDate.getTime();
      return t <= in90 && t >= now;
    });
    const expired = item.batches.some((batch) => batch.expiryDate.getTime() < now);
    return {
      id: item.id,
      name: item.name,
      genericName: item.genericName,
      manufacturer: item.manufacturer,
      unit: item.unit,
      barcode: item.barcode,
      stock,
      reorderLevel: item.reorderLevel,
      lowStock: stock <= item.reorderLevel,
      nearExpiry,
      expired,
      nearestExpiry,
      batchCount: item.batches.length,
      mrp: item.mrp != null ? Number(item.mrp) : null,
      expiringIn30: item.batches.some((b) => {
        const t = b.expiryDate.getTime();
        return t <= in30 && t >= now;
      }),
    };
  });
}

export async function findPharmacyItemByBarcode(hospitalId: string, barcode: string) {
  const code = barcode.trim();
  if (!code) return null;
  return prisma.pharmacyItem.findFirst({
    where: { hospitalId, barcode: code, isActive: true },
  });
}

export async function searchPharmacyOrCatalog(hospitalId: string, q: string, limit = 12) {
  const query = q.trim();
  if (query.length < 2) return { items: [] as const, catalog: [] as const };

  const items = await prisma.pharmacyItem.findMany({
    where: {
      hospitalId,
      isActive: true,
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { genericName: { contains: query, mode: "insensitive" } },
        { barcode: { contains: query, mode: "insensitive" } },
      ],
    },
    take: limit,
    orderBy: { name: "asc" },
  });

  const brands = await prisma.hospitalDrugManufacturer.findMany({
    where: { hospitalId },
    select: { manufacturer: { select: { name: true } } },
  });
  const brandNames = brands.map((row) => row.manufacturer.name);
  const pattern = `%${query.replace(/[%_\\]/g, "\\$&")}%`;

  const catalog =
    brandNames.length > 0
      ? await prisma.$queryRaw<
          Array<{ id: string; name: string; saltComposition: string | null; manufacturer: string | null; packSize: string | null }>
        >`
          SELECT "id", "name", "saltComposition", "manufacturer", "packSize"
          FROM "DrugCatalog"
          WHERE "isDiscontinued" = false
            AND "searchText" ILIKE ${pattern} ESCAPE '\\'
            AND "manufacturer" IN (${Prisma.join(brandNames)})
          ORDER BY "name" ASC
          LIMIT ${limit}
        `
      : await prisma.$queryRaw<
          Array<{ id: string; name: string; saltComposition: string | null; manufacturer: string | null; packSize: string | null }>
        >`
          SELECT "id", "name", "saltComposition", "manufacturer", "packSize"
          FROM "DrugCatalog"
          WHERE "isDiscontinued" = false
            AND "searchText" ILIKE ${pattern} ESCAPE '\\'
          ORDER BY "name" ASC
          LIMIT ${limit}
        `;

  return {
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      genericName: item.genericName,
      manufacturer: item.manufacturer,
      barcode: item.barcode,
      unit: item.unit,
      source: "stock" as const,
    })),
    catalog: catalog.map((row) => ({
      id: row.id,
      name: row.name,
      genericName: row.saltComposition,
      manufacturer: row.manufacturer,
      packSize: row.packSize,
      source: "catalog" as const,
    })),
  };
}

export async function receiveGrn(params: {
  hospitalId: string;
  actorUserId: string;
  actorUsername: string;
  supplierName?: string | null;
  invoiceNo?: string | null;
  invoiceDate?: string | null;
  notes?: string | null;
  lines: GrnLineInput[];
}) {
  if (params.lines.length === 0) {
    throw new Error("Add at least one medicine line.");
  }

  return prisma.$transaction(async (tx) => {
    let supplierId: string | null = null;
    const supplierName = params.supplierName?.trim();
    if (supplierName) {
      const existing = await tx.pharmacySupplier.findFirst({
        where: { hospitalId: params.hospitalId, name: { equals: supplierName, mode: "insensitive" } },
      });
      if (existing) {
        supplierId = existing.id;
      } else {
        const created = await tx.pharmacySupplier.create({
          data: { hospitalId: params.hospitalId, name: supplierName },
        });
        supplierId = created.id;
      }
    }

    const grn = await tx.pharmacyGrn.create({
      data: {
        hospitalId: params.hospitalId,
        supplierId,
        invoiceNo: params.invoiceNo?.trim() || null,
        invoiceDate: parseDate(params.invoiceDate),
        notes: params.notes?.trim() || null,
        receivedByUserId: params.actorUserId,
        receivedByUsername: params.actorUsername,
      },
    });

    for (const line of params.lines) {
      const qty = Math.trunc(Number(line.quantity));
      const purchaseRate = Number(line.purchaseRate);
      const mrp = Number(line.mrp);
      const batchNo = line.batchNo.trim();
      const expiryDate = parseDate(line.expiryDate);
      if (!batchNo || !expiryDate || !Number.isFinite(qty) || qty <= 0) {
        throw new Error(`Invalid line for ${line.name}: batch, expiry, and quantity are required.`);
      }
      if (!Number.isFinite(purchaseRate) || purchaseRate < 0 || !Number.isFinite(mrp) || mrp < 0) {
        throw new Error(`Invalid rates for ${line.name}.`);
      }

      let item =
        line.itemId
          ? await tx.pharmacyItem.findFirst({
              where: { id: line.itemId, hospitalId: params.hospitalId },
            })
          : null;

      if (!item && line.barcode?.trim()) {
        item = await tx.pharmacyItem.findFirst({
          where: { hospitalId: params.hospitalId, barcode: line.barcode.trim() },
        });
      }

      if (!item) {
        item = await tx.pharmacyItem.create({
          data: {
            hospitalId: params.hospitalId,
            name: line.name.trim(),
            genericName: line.genericName?.trim() || null,
            manufacturer: line.manufacturer?.trim() || null,
            unit: line.unit?.trim() || "tablet",
            barcode: line.barcode?.trim() || null,
            catalogDrugId: line.catalogDrugId || null,
            gstPercent: line.gstPercent ?? 5,
            mrp,
          },
        });
      } else {
        item = await tx.pharmacyItem.update({
          where: { id: item.id },
          data: {
            mrp,
            ...(line.barcode?.trim() && !item.barcode ? { barcode: line.barcode.trim() } : {}),
          },
        });
      }

      let batch = await tx.pharmacyBatch.findFirst({
        where: { hospitalId: params.hospitalId, itemId: item.id, batchNo },
      });

      if (batch) {
        batch = await tx.pharmacyBatch.update({
          where: { id: batch.id },
          data: {
            quantityReceived: { increment: qty },
            quantityAvailable: { increment: qty },
            purchaseRate,
            mrp,
            supplierId,
            mfgDate: parseDate(line.mfgDate) ?? batch.mfgDate,
            expiryDate,
          },
        });
      } else {
        batch = await tx.pharmacyBatch.create({
          data: {
            hospitalId: params.hospitalId,
            itemId: item.id,
            supplierId,
            batchNo,
            mfgDate: parseDate(line.mfgDate),
            expiryDate,
            purchaseRate,
            mrp,
            quantityReceived: qty,
            quantityAvailable: qty,
          },
        });
      }

      await tx.pharmacyGrnLine.create({
        data: {
          grnId: grn.id,
          itemId: item.id,
          batchId: batch.id,
          quantity: qty,
          purchaseRate,
          mrp,
        },
      });

      await tx.pharmacyLedger.create({
        data: {
          hospitalId: params.hospitalId,
          itemId: item.id,
          batchId: batch.id,
          kind: "GRN_IN",
          quantityDelta: qty,
          quantityAfter: batch.quantityAvailable,
          reason: "Goods receipt",
          refType: "PharmacyGrn",
          refId: grn.id,
          actorUserId: params.actorUserId,
          actorUsername: params.actorUsername,
        },
      });
    }

    return grn;
  });
}
