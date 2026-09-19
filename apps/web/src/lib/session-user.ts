import { createHash } from "crypto";
import { prisma } from "./prisma";
import { SESSION_COOKIE, sessionExpiresAt, shouldRefreshSession } from "./session-policy";

export { SESSION_COOKIE };

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export type LoadedSession = {
  token: string;
  expiresAt: Date;
  user: NonNullable<Awaited<ReturnType<typeof loadUserFromSession>>>["user"];
};

async function loadUserFromSession(tokenHash: string) {
  return prisma.appSession.findUnique({
    where: { token: tokenHash },
    include: {
      user: {
        include: {
          hospital: { include: { subscription: true } },
          staffProfile: { select: { id: true, role: true, isActive: true } },
        },
      },
    },
  });
}

export async function loadSessionByToken(token: string | null | undefined): Promise<LoadedSession | null> {
  if (!token) return null;

  const tokenHash = hashToken(token);
  const session = await loadUserFromSession(tokenHash);

  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await prisma.appSession.delete({ where: { id: session.id } }).catch(() => undefined);
    }
    return null;
  }

  const user = session.user;
  if (user.isActive === false) {
    await prisma.appSession.deleteMany({ where: { userId: user.id } }).catch(() => undefined);
    return null;
  }

  if (user.hospitalId && user.hospital && user.hospital.isActive === false) {
    await prisma.appSession.deleteMany({ where: { userId: user.id } }).catch(() => undefined);
    return null;
  }

  let expiresAt = session.expiresAt;
  const lastSeenAt = (session as typeof session & { lastSeenAt?: Date }).lastSeenAt ?? session.createdAt;
  if (shouldRefreshSession(lastSeenAt)) {
    const now = new Date();
    expiresAt = sessionExpiresAt(now);
    await prisma.appSession
      .update({
        where: { id: session.id },
        data: { lastSeenAt: now, expiresAt } as never,
      })
      .catch(() => undefined);
  }

  return { token, expiresAt, user };
}

export async function getUserBySessionToken(token: string | null | undefined) {
  const loaded = await loadSessionByToken(token);
  return loaded?.user ?? null;
}
