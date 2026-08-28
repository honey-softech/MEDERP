import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { sanitizeSignatureData } from "@/lib/front-desk";
import { signatureCredentialsFor, signatureNameFor } from "@/lib/signatures";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Only hospital admins and platform admins may touch signatures — staff cannot upload
 * their own, so the upload itself is the verification.
 */
async function resolveTarget(userId: string) {
  const actor = await getCurrentUser();
  if (!actor) {
    return { error: NextResponse.json({ error: "Sign in required." }, { status: 401 }) };
  }
  const isPlatformAdmin = actor.role === "SOFTWARE_ADMIN";
  if (!isPlatformAdmin && (actor.role !== "SUPER_ADMIN" || !actor.hospitalId)) {
    return { error: NextResponse.json({ error: "Hospital admin access required." }, { status: 403 }) };
  }

  const target = await prisma.appUser.findFirst({
    where: { id: userId, ...(isPlatformAdmin ? {} : { hospitalId: actor.hospitalId }) },
    include: { staffProfile: true },
  });
  if (!target || !target.hospitalId) {
    return { error: NextResponse.json({ error: "User not found." }, { status: 404 }) };
  }
  if (target.role === "SOFTWARE_ADMIN" || target.role === "HELPDESK") {
    return { error: NextResponse.json({ error: "Platform accounts do not sign documents." }, { status: 400 }) };
  }
  return { actor, target, hospitalId: target.hospitalId };
}

export async function GET(_request: Request, context: Ctx) {
  const { id } = await context.params;
  const resolved = await resolveTarget(id);
  if ("error" in resolved) return resolved.error;

  const metadata = {
    id: true,
    status: true,
    version: true,
    displayName: true,
    credentials: true,
    uploadedByUsername: true,
    createdAt: true,
    revokedAt: true,
  } as const;

  // Only the live signature ships its image; revoked versions stay metadata-only.
  const [active, history] = await Promise.all([
    prisma.userSignature.findFirst({
      where: { userId: id, hospitalId: resolved.hospitalId, status: "ACTIVE" },
      orderBy: { version: "desc" },
      select: { ...metadata, imageData: true },
    }),
    prisma.userSignature.findMany({
      where: { userId: id, hospitalId: resolved.hospitalId, status: { not: "ACTIVE" } },
      orderBy: { version: "desc" },
      select: metadata,
    }),
  ]);

  return NextResponse.json({
    active,
    history,
    suggestedName: signatureNameFor(resolved.target),
    suggestedCredentials: signatureCredentialsFor(resolved.target),
  });
}

export async function POST(request: Request, context: Ctx) {
  const { id } = await context.params;
  const resolved = await resolveTarget(id);
  if ("error" in resolved) return resolved.error;
  const { actor, target, hospitalId } = resolved;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const imageData = sanitizeSignatureData(body?.imageData);
  if (!imageData) {
    return NextResponse.json(
      { error: "Upload a PNG or JPG signature under 300 KB. Crop tighter if the file is too large." },
      { status: 400 },
    );
  }
  const displayName = String(body?.displayName ?? "").trim() || signatureNameFor(target);
  const credentials = String(body?.credentials ?? "").trim() || null;
  if (!displayName) {
    return NextResponse.json({ error: "Enter the name to print under the signature." }, { status: 400 });
  }

  const latest = await prisma.userSignature.findFirst({
    where: { userId: id, hospitalId },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  const signature = await prisma.$transaction(async (tx) => {
    // Old rows are revoked, never updated, so documents referencing them still print.
    await tx.userSignature.updateMany({
      where: { userId: id, hospitalId, status: "ACTIVE" },
      data: { status: "REVOKED", revokedAt: new Date() },
    });
    return tx.userSignature.create({
      data: {
        hospitalId,
        userId: id,
        imageData,
        displayName,
        credentials,
        status: "ACTIVE",
        version: (latest?.version ?? 0) + 1,
        uploadedByUserId: actor.id,
        uploadedByUsername: actor.username,
        verifiedByUserId: actor.id,
        verifiedByUsername: actor.username,
        verifiedAt: new Date(),
      },
      select: { id: true, version: true, displayName: true, credentials: true, status: true, createdAt: true },
    });
  });

  await writeAuditLog({
    request,
    hospitalId,
    actorUserId: actor.id,
    actorUsername: actor.username,
    actorRole: actor.role,
    action: "SIGNATURE_UPLOADED",
    entity: "UserSignature",
    entityId: signature.id,
    summary: `${actor.username} uploaded signature v${signature.version} for ${displayName}.`,
    metadata: { targetUserId: id, version: signature.version },
  });

  return NextResponse.json({ ok: true, signature });
}

export async function PATCH(request: Request, context: Ctx) {
  const { id } = await context.params;
  const resolved = await resolveTarget(id);
  if ("error" in resolved) return resolved.error;
  const { actor, hospitalId } = resolved;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (String(body?.action ?? "") !== "revoke") {
    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  }

  const active = await prisma.userSignature.findFirst({
    where: { userId: id, hospitalId, status: "ACTIVE" },
    orderBy: { version: "desc" },
    select: { id: true, displayName: true, version: true },
  });
  if (!active) {
    return NextResponse.json({ error: "There is no signature on file to revoke." }, { status: 404 });
  }

  await prisma.userSignature.update({
    where: { id: active.id },
    data: { status: "REVOKED", revokedAt: new Date() },
  });

  await writeAuditLog({
    request,
    hospitalId,
    actorUserId: actor.id,
    actorUsername: actor.username,
    actorRole: actor.role,
    action: "SIGNATURE_REVOKED",
    entity: "UserSignature",
    entityId: active.id,
    summary: `${actor.username} revoked signature v${active.version} for ${active.displayName}.`,
    metadata: { targetUserId: id, version: active.version },
  });

  return NextResponse.json({ ok: true });
}
