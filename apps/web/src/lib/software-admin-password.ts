import { verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Confirms the signed-in software admin typed their own password. */
export async function assertSoftwareAdminPassword(actorId: string, password: unknown) {
  const value = String(password ?? "");
  if (!value) {
    return { ok: false as const, error: "Enter your software admin password.", status: 400 };
  }

  const actor = await prisma.appUser.findUnique({
    where: { id: actorId },
    select: { role: true, passwordHash: true, isActive: true },
  });
  if (!actor || actor.role !== "SOFTWARE_ADMIN" || !actor.isActive) {
    return { ok: false as const, error: "Software admin access required.", status: 403 };
  }

  const matches = await verifyPassword(value, actor.passwordHash);
  if (!matches) {
    return { ok: false as const, error: "Password does not match.", status: 401 };
  }
  return { ok: true as const };
}
