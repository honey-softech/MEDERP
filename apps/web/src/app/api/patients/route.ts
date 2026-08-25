import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const patients = await prisma.patient.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json({ patients });
  } catch {
    return NextResponse.json(
      { error: "Database unavailable. Run Prisma migrate after PostgreSQL is ready." },
      { status: 503 },
    );
  }
}
