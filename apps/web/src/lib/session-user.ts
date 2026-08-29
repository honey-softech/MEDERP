import { createHash } from "crypto";
import { prisma } from "./prisma";

export const SESSION_COOKIE = "mederp_session";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function getUserBySessionToken(token: string | null | undefined) {
  if (!token) return null;

  const tokenHash = hashToken(token);
  const session = await prisma.appSession.findUnique({
    where: { token: tokenHash },
    include: { user: { include: { hospital: { include: { subscription: true } } } } },
  });

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

  return user;
}
