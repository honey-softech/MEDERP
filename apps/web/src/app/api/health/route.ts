import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, service: "mederp-web", database: "up" });
  } catch {
    return NextResponse.json(
      { ok: false, service: "mederp-web", database: "down" },
      { status: 503 },
    );
  }
}
