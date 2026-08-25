import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "SOFTWARE_ADMIN") {
    return NextResponse.json({ error: "Software admin access required." }, { status: 403 });
  }

  const users = await prisma.appUser.findMany({
    where: { role: { not: "SOFTWARE_ADMIN" } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      username: true,
      mobile: true,
      role: true,
      isVerified: true,
      createdAt: true,
      updatedAt: true,
      hospital: { select: { id: true, name: true, code: true } },
      sessions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true, expiresAt: true },
      },
    },
  });

  return NextResponse.json({ users });
}
