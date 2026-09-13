import { prisma } from "@/lib/prisma";
import { signatureCredentialsFor, signatureNameFor } from "@/lib/signatures";

export type ReceiptCollector = {
  name: string;
  credentials: string | null;
  imageData: string | null;
};

export async function resolveReceiptCollector(payments: {
  kind: string;
  receivedByUserId: string | null;
  receivedBySignature: { imageData: string; displayName: string; credentials: string | null } | null;
}[]): Promise<ReceiptCollector | null> {
  const latestCollection = payments.find((payment) => payment.kind === "COLLECTION") ?? null;
  if (latestCollection?.receivedBySignature) {
    return {
      name: latestCollection.receivedBySignature.displayName,
      credentials: latestCollection.receivedBySignature.credentials,
      imageData: latestCollection.receivedBySignature.imageData,
    };
  }
  if (!latestCollection?.receivedByUserId) return null;

  const receiver = await prisma.appUser.findUnique({
    where: { id: latestCollection.receivedByUserId },
    include: {
      staffProfile: true,
      signatures: {
        where: { status: "ACTIVE" },
        orderBy: { version: "desc" },
        take: 1,
        select: { imageData: true, displayName: true, credentials: true },
      },
    },
  });
  if (!receiver) return null;
  const live = receiver.signatures[0] ?? null;
  return {
    name: live?.displayName ?? signatureNameFor(receiver),
    credentials: live?.credentials ?? signatureCredentialsFor(receiver),
    imageData: live?.imageData ?? null,
  };
}
