import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { notifyHelpdeskReply } from "@/lib/helpdesk";
import { issueOtp, otpErrorMessage, verifyAndConsumeOtp } from "@/lib/otp";
import { isValidIndianMobile, normalizeMobile } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";

const OTP_OK = {
  ok: true,
  message: "If that mobile number is registered, an OTP has been sent.",
};

const STATUS_TOKEN_TTL_MS = 30 * 60 * 1000;

function statusSecret() {
  return process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET || "mederp-help-status";
}

function issueStatusToken(userId: string) {
  const exp = Date.now() + STATUS_TOKEN_TTL_MS;
  const payload = `${userId}.${exp}`;
  const sig = createHmac("sha256", statusSecret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

function verifyStatusToken(token: string, userId: string) {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [uid, expRaw, sig] = parts;
  if (uid !== userId) return false;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = createHmac("sha256", statusSecret()).update(`${uid}.${expRaw}`).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const limited = checkRateLimit(clientKey(request, "public-help-status"), {
    limit: 8,
    windowMs: 15 * 60 * 1000,
    lockMs: 30 * 60 * 1000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: `Too many requests. Try again in ${limited.retryAfterSec} seconds.` },
      { status: 429 },
    );
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const step = String(body?.step ?? "request-otp").trim().toLowerCase();
  const mobile = normalizeMobile(String(body?.mobile ?? ""));
  if (!isValidIndianMobile(mobile)) {
    return NextResponse.json({ error: "Enter a valid 10-digit mobile number." }, { status: 400 });
  }

  const user = await prisma.appUser.findUnique({
    where: { mobile },
    select: {
      id: true,
      username: true,
      mobile: true,
      hospitalId: true,
      otpCode: true,
      otpExpiresAt: true,
      otpAttempts: true,
      role: true,
    },
  });

  if (step === "request-otp") {
    if (user && user.role !== "SOFTWARE_ADMIN" && user.role !== "HELPDESK") {
      await issueOtp(user.id, user.mobile, "public-help-status");
      await writeAuditLog({
        request,
        hospitalId: user.hospitalId,
        actorUserId: user.id,
        actorUsername: user.username,
        actorRole: user.role,
        action: "PUBLIC_HELP_STATUS_OTP_REQUESTED",
        entity: "AppUser",
        entityId: user.id,
        summary: `${user.username} requested a public helpdesk status OTP.`,
      });
    }
    return NextResponse.json({ ...OTP_OK, mobile });
  }

  if (!user) {
    return NextResponse.json({ error: "Could not verify that mobile number." }, { status: 400 });
  }
  if (user.role === "SOFTWARE_ADMIN" || user.role === "HELPDESK") {
    return NextResponse.json({ error: "Use the signed-in helpdesk for platform accounts." }, { status: 400 });
  }

  if (step === "fetch") {
    const otp = String(body?.otp ?? "").trim();
    if (!otp) {
      return NextResponse.json({ error: "Enter the OTP sent to your mobile." }, { status: 400 });
    }
    const verified = await verifyAndConsumeOtp(user, otp);
    if (!verified.ok) {
      return NextResponse.json({ error: otpErrorMessage(verified.error) }, { status: 400 });
    }

    const tickets = await prisma.helpdeskTicket.findMany({
      where: {
        OR: [{ contactMobile: mobile }, { createdById: user.id }],
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
      include: {
        hospital: { select: { name: true } },
        messages: {
          where: { kind: { in: ["PUBLIC", "SYSTEM"] } },
          orderBy: { createdAt: "asc" },
          include: { author: { select: { username: true, role: true } } },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      statusToken: issueStatusToken(user.id),
      tickets: tickets.map((ticket) => ({
        id: ticket.id,
        number: ticket.number,
        subject: ticket.subject,
        status: ticket.status,
        priority: ticket.priority,
        category: ticket.category,
        hospitalName: ticket.hospital?.name ?? null,
        updatedAt: ticket.updatedAt,
        messages: ticket.messages.map((message) => ({
          id: message.id,
          body: message.body,
          kind: message.kind,
          createdAt: message.createdAt,
          author: message.author.username,
          authorRole: message.author.role,
        })),
      })),
    });
  }

  if (step === "reply") {
    const statusToken = String(body?.statusToken ?? "").trim();
    if (!verifyStatusToken(statusToken, user.id)) {
      return NextResponse.json({ error: "Session expired. Verify OTP again." }, { status: 401 });
    }

    const ticketId = String(body?.ticketId ?? "").trim();
    const message = String(body?.body ?? "").trim();
    if (!ticketId) {
      return NextResponse.json({ error: "Select a ticket." }, { status: 400 });
    }
    if (message.length < 2) {
      return NextResponse.json({ error: "Enter a reply." }, { status: 400 });
    }

    const ticket = await prisma.helpdeskTicket.findFirst({
      where: {
        id: ticketId,
        OR: [{ contactMobile: mobile }, { createdById: user.id }],
      },
    });
    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
    }
    if (ticket.status === "CLOSED") {
      return NextResponse.json({ error: "This request is closed." }, { status: 400 });
    }

    const now = new Date();
    const data: Prisma.HelpdeskTicketUpdateInput = {
      lastRequesterReplyAt: now,
    };
    if (ticket.status === "RESOLVED") {
      data.status = "OPEN";
      data.resolvedAt = null;
      data.reopenedCount = { increment: 1 };
    } else {
      data.status = "IN_PROGRESS";
    }

    await prisma.helpdeskMessage.create({
      data: { ticketId: ticket.id, authorId: user.id, body: message, kind: "PUBLIC" },
    });
    const updated = await prisma.helpdeskTicket.update({
      where: { id: ticket.id },
      data,
    });

    await notifyHelpdeskReply({
      ticket: updated,
      actorId: user.id,
      actorRole: user.role,
      preview: message,
    });
    await writeAuditLog({
      request,
      hospitalId: ticket.hospitalId,
      actorUserId: user.id,
      actorUsername: user.username,
      actorRole: user.role,
      action: "HELPDESK_REPLY",
      entity: "HelpdeskTicket",
      entityId: ticket.id,
      summary: `${user.username} replied on helpdesk ${ticket.number} via public status page.`,
      metadata: { publicStatus: true },
    });

    return NextResponse.json({
      ok: true,
      ticket: { id: updated.id, number: updated.number, status: updated.status },
    });
  }

  return NextResponse.json({ error: "Unknown step." }, { status: 400 });
}
