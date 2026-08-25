import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== "SUPER_ADMIN" || !actor.hospitalId) {
    return NextResponse.json({ error: "Hospital super admin access required." }, { status: 403 });
  }

  const logs = await prisma.auditLog.findMany({
    where: { hospitalId: actor.hospitalId },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({
    hospital: actor.hospital,
    logs,
  });
}
