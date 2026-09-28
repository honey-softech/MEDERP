import { PrismaClient } from "@prisma/client";

/** Bump when the schema gains models so a long-running dev server drops a stale client. */
const PRISMA_CLIENT_STAMP = "20260928-demo-bookings";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; prismaStamp?: string };

const cached = globalForPrisma.prismaStamp === PRISMA_CLIENT_STAMP ? globalForPrisma.prisma : undefined;
if (globalForPrisma.prisma && globalForPrisma.prisma !== cached) {
  void globalForPrisma.prisma.$disconnect().catch(() => undefined);
}

export const prisma = cached ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaStamp = PRISMA_CLIENT_STAMP;
}
