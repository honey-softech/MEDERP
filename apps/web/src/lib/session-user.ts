import { prisma } from "./prisma";

export const SESSION_COOKIE = "mederp_session";

export async function getUserBySessionToken(token: string | null | undefined) {
  if (!token) return null;

  const session = await prisma.appSession.findUnique({
    where: { token },
    include: { user: { include: { hospital: true } } },
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await prisma.appSession.delete({ where: { id: session.id } });
    }
    return null;
  }

  return session.user;
}
