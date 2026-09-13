import { NextResponse } from "next/server";
import { isMediaWriteAuthorized, readWhatsAppDocument, storeWhatsAppDocument } from "@/lib/messaging/whatsapp-media";

function fileResponse(file: NonNullable<ReturnType<typeof readWhatsAppDocument>>) {
  const body = new Uint8Array(file.buffer);
  return new NextResponse(body, {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(body.byteLength),
      "Content-Disposition": `inline; filename="${file.filename.replace(/"/g, "")}"`,
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const file = readWhatsAppDocument(id);
  if (!file) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }
  return fileResponse(file);
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const provided =
    request.headers.get("x-mederp-media-key")?.trim() ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    new URL(request.url).searchParams.get("token")?.trim() ||
    "";
  if (!isMediaWriteAuthorized(provided)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { id } = await context.params;
  const stored = storeWhatsAppDocument(id, {
    buffer: Buffer.from(await request.arrayBuffer()),
    filename: decodeURIComponent(request.headers.get("x-filename") || "document.pdf"),
    mimeType: request.headers.get("content-type") || "application/pdf",
  });
  if (!stored.ok) {
    return NextResponse.json({ error: stored.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export async function HEAD(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const file = readWhatsAppDocument(id);
  if (!file) {
    return new NextResponse(null, { status: 404 });
  }
  return new NextResponse(null, {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(file.buffer.byteLength),
      "Access-Control-Allow-Origin": "*",
    },
  });
}
