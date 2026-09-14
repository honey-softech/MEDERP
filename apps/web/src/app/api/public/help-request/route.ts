import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit";
import {
  HELPDESK_CATEGORIES,
  HELPDESK_PRIORITIES,
  nextHelpdeskNumber,
  notifyHelpdeskOpened,
} from "@/lib/helpdesk";
import { slaDueDates } from "@/lib/helpdesk-sla";
import { issueOtp, otpErrorMessage, verifyAndConsumeOtp } from "@/lib/otp";
import { isValidIndianMobile, normalizeMobile } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";
import type { HelpdeskTicketPriority } from "@prisma/client";

const OTP_OK = {
  ok: true,
  message: "If that mobile number is registered, an OTP has been sent.",
};

export async function POST(request: Request) {
  const limited = checkRateLimit(clientKey(request, "public-help"), {
    limit: 8,
    windowMs: 15 * 60 * 1000,
    lockMs: 30 * 60 * 1000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: `Too many help requests. Try again in ${limited.retryAfterSec} seconds.` },
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
      firstName: true,
      lastName: true,
      hospitalId: true,
      otpCode: true,
      otpExpiresAt: true,
      otpAttempts: true,
      role: true,
    },
  });

  if (step === "request-otp") {
    // Issue even when the account is deactivated — that is the locked-out case.
    if (user && user.role !== "SOFTWARE_ADMIN" && user.role !== "HELPDESK") {
      await issueOtp(user.id, user.mobile, "public-help");
      await writeAuditLog({
        request,
        hospitalId: user.hospitalId,
        actorUserId: user.id,
        actorUsername: user.username,
        actorRole: user.role,
        action: "PUBLIC_HELP_OTP_REQUESTED",
        entity: "AppUser",
        entityId: user.id,
        summary: `${user.username} requested a public helpdesk OTP.`,
      });
    }
    return NextResponse.json({ ...OTP_OK, mobile });
  }

  if (step !== "submit") {
    return NextResponse.json({ error: "Unknown step." }, { status: 400 });
  }

  const otp = String(body?.otp ?? "").trim();
  const subject = String(body?.subject ?? "").trim();
  const category = String(body?.category ?? "ACCESS").trim().toUpperCase();
  const message = String(body?.body ?? "").trim();
  const contactName = String(body?.contactName ?? "").trim();
  const priority = String(body?.priority ?? "HIGH").trim().toUpperCase();

  if (!otp) {
    return NextResponse.json({ error: "Enter the OTP sent to your mobile." }, { status: 400 });
  }
  if (!user) {
    return NextResponse.json({ error: "Could not verify that mobile number." }, { status: 400 });
  }
  if (user.role === "SOFTWARE_ADMIN" || user.role === "HELPDESK") {
    return NextResponse.json({ error: "Use the signed-in helpdesk for platform accounts." }, { status: 400 });
  }

  const verified = await verifyAndConsumeOtp(user, otp);
  if (!verified.ok) {
    return NextResponse.json({ error: otpErrorMessage(verified.error) }, { status: 400 });
  }
  if (subject.length < 4) {
    return NextResponse.json({ error: "Enter a short subject." }, { status: 400 });
  }
  if (message.length < 8) {
    return NextResponse.json({ error: "Describe the issue in a bit more detail." }, { status: 400 });
  }
  if (!HELPDESK_CATEGORIES.some((item) => item.value === category)) {
    return NextResponse.json({ error: "Select a valid category." }, { status: 400 });
  }
  if (!HELPDESK_PRIORITIES.some((item) => item.value === priority) && priority !== "URGENT") {
    return NextResponse.json({ error: "Select a valid priority." }, { status: 400 });
  }

  const displayName =
    contactName ||
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    user.username;

  const storedPriority = (
    priority === "URGENT" ? "HIGH" : priority
  ) as HelpdeskTicketPriority;
  const due = slaDueDates(storedPriority);
  const ticket = await prisma.helpdeskTicket.create({
    data: {
      number: await nextHelpdeskNumber(),
      hospitalId: user.hospitalId,
      createdById: user.id,
      contactMobile: user.mobile,
      contactName: displayName,
      subject,
      category,
      priority: storedPriority,
      firstResponseDueAt: due.firstResponseDueAt,
      resolutionDueAt: due.resolutionDueAt,
      messages: { create: { authorId: user.id, body: message, kind: "PUBLIC" } },
    },
  });

  await notifyHelpdeskOpened(ticket, user.id);
  await writeAuditLog({
    request,
    hospitalId: user.hospitalId,
    actorUserId: user.id,
    actorUsername: user.username,
    actorRole: user.role,
    action: "HELPDESK_TICKET_OPENED",
    entity: "HelpdeskTicket",
    entityId: ticket.id,
    summary: `${user.username} opened helpdesk ${ticket.number} from the public help page.`,
    metadata: { publicHelp: true, contactMobile: user.mobile },
  });

  return NextResponse.json({
    ok: true,
    ticket: { id: ticket.id, number: ticket.number },
    message: `Request ${ticket.number} submitted. MedERP support will follow up.`,
  });
}
