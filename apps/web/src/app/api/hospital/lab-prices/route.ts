import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHospitalActor } from "@/lib/front-desk";
import { syncLabCatalog } from "@/lib/lab";

export async function GET() {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  if (scoped.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Hospital super admin access required." }, { status: 403 });
  }

  await syncLabCatalog();
  const tests = await prisma.labTest.findMany({
    where: { isActive: true, kind: "BLOOD" },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { hospitalPrices: { where: { hospitalId: scoped.user.hospitalId } } },
  });

  return NextResponse.json({
    tests: tests.map((test) => ({
      id: test.id,
      code: test.code,
      name: test.name,
      category: test.category,
      description: test.description,
      defaultPrice: Number(test.price),
      price: Number(test.hospitalPrices[0]?.price ?? test.price),
      isOffered: test.hospitalPrices[0]?.isOffered ?? true,
    })),
  });
}

export async function PUT(request: Request) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  if (scoped.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Hospital super admin access required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const rows = Array.isArray(body?.prices) ? body.prices : [];
  await syncLabCatalog();

  for (const row of rows) {
    const testId = String(row?.testId ?? "");
    const price = Number(row?.price);
    const isOffered = row?.isOffered !== false;
    if (!testId || !(price >= 0)) continue;
    await prisma.hospitalLabPrice.upsert({
      where: { hospitalId_testId: { hospitalId: scoped.user.hospitalId, testId } },
      update: { price, isOffered },
      create: { hospitalId: scoped.user.hospitalId, testId, price, isOffered },
    });
  }

  return NextResponse.json({ ok: true });
}
