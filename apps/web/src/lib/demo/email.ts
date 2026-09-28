import { Resend } from "resend";
import { buildDemoIcs } from "./ics";

type MailInput = {
  to: string;
  subject: string;
  text: string;
  ics?: { filename: string; content: string };
};

export type DemoMailResult =
  | { ok: true; skipped?: false }
  | { ok: true; skipped: true }
  | { ok: false; error: string };

export async function sendDemoMail(input: MailInput): Promise<DemoMailResult> {
  // Optional: set DEMO_EMAIL_ENABLED=1 plus Resend domain + keys to send MedERP emails.
  // Default is Google Calendar invites only (no Resend domain required).
  if (process.env.DEMO_EMAIL_ENABLED?.trim() !== "1") {
    return { ok: true, skipped: true };
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.DEMO_FROM_EMAIL?.trim();
  if (!apiKey || !from) {
    console.warn(
      "[demo-email] Skipped — set DEMO_EMAIL_ENABLED=1, RESEND_API_KEY, and DEMO_FROM_EMAIL.",
      { to: input.to, subject: input.subject },
    );
    return { ok: true, skipped: true };
  }

  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    attachments: input.ics
      ? [
          {
            filename: input.ics.filename,
            content: Buffer.from(input.ics.content, "utf8"),
            contentType: "text/calendar",
          },
        ]
      : undefined,
  });
  if (result.error) {
    console.error("[demo-email] Resend error:", result.error.message, { to: input.to, from });
    return { ok: false, error: result.error.message };
  }
  return { ok: true };
}

function whenLabel(start: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone,
    dateStyle: "full",
    timeStyle: "short",
  }).format(start);
}

export async function sendBookingEmails(params: {
  name: string;
  email: string;
  organization?: string | null;
  phone?: string | null;
  notes?: string | null;
  start: Date;
  end: Date;
  timeZone: string;
  cancelUrl: string;
  meetLink?: string | null;
  notifyEmail?: string | null;
  uid: string;
  cancelled?: boolean;
}): Promise<{ status: "sent" | "skipped" | "failed"; warning: string | null }> {
  const when = whenLabel(params.start, params.timeZone);
  const summary = params.cancelled ? "Cancelled: MedERP product demo" : "MedERP product demo";
  const description = [
    `Demo with ${params.name}`,
    params.organization ? `Organisation: ${params.organization}` : "",
    params.meetLink ? `Meet: ${params.meetLink}` : "",
    params.cancelled ? "This demo was cancelled." : `Cancel: ${params.cancelUrl}`,
  ]
    .filter(Boolean)
    .join("\n");
  const ics = buildDemoIcs({
    uid: params.uid,
    start: params.start,
    end: params.end,
    summary,
    description,
    method: params.cancelled ? "CANCEL" : "REQUEST",
    meetLink: params.meetLink,
  });
  const prospectText = params.cancelled
    ? `Hi ${params.name},\n\nYour MedERP demo on ${when} has been cancelled.\n`
    : `Hi ${params.name},\n\nYour MedERP demo is booked for ${when} (${params.timeZone}).\n${
        params.meetLink ? `\nJoin: ${params.meetLink}\n` : ""
      }\nA calendar file is attached.\n\nNeed to cancel? ${params.cancelUrl}\n`;
  const salesText = params.cancelled
    ? `Demo cancelled.\n\n${params.name} <${params.email}>\n${when}\n`
    : `New demo booked.\n\n${params.name} <${params.email}>\n${params.organization ?? ""}\n${params.phone ?? ""}\n${when}\n${params.notes ?? ""}\n${params.meetLink ?? ""}\n`;

  const prospect = await sendDemoMail({
    to: params.email,
    subject: summary,
    text: prospectText,
    ics: { filename: params.cancelled ? "mederp-demo-cancel.ics" : "mederp-demo.ics", content: ics },
  });

  const notify = params.notifyEmail?.trim();
  if (notify) {
    await sendDemoMail({
      to: notify,
      subject: `${params.cancelled ? "Cancelled demo" : "New demo"} — ${params.name}`,
      text: salesText,
      ics: { filename: "mederp-demo.ics", content: ics },
    });
  }

  if (!prospect.ok) {
    return { status: "failed", warning: prospect.error };
  }
  if (prospect.skipped) {
    return {
      status: "skipped",
      warning: "Email is not configured (RESEND_API_KEY / DEMO_FROM_EMAIL). Google may still email the calendar invite.",
    };
  }
  return { status: "sent", warning: null };
}
