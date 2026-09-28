import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendBookingEmails } from "./email";
import { createDemoEvent, deleteDemoEvent, freeBusy } from "./google-calendar";
import { getDemoSettings, notifyAddress, publicBaseUrl } from "./settings";
import {
  addDaysToDateKey,
  availableSlots,
  buildCandidateSlots,
  dateKeyInZone,
  expandInterval,
  formatSlotLabel,
  zonedTimeToUtc,
} from "./slots";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class DemoError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function assertDateKey(dateKey: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw new DemoError("Choose a valid date.", 400);
  }
}

export async function listSlotsForDate(dateKey: string, now = new Date()) {
  assertDateKey(dateKey);
  const settings = await getDemoSettings();
  const today = dateKeyInZone(now, settings.timezone);
  const last = addDaysToDateKey(today, settings.lookAheadDays - 1);
  if (dateKey < today || dateKey > last) {
    throw new DemoError("That date is outside the booking window.", 400);
  }
  const rangeStart = zonedTimeToUtc(dateKey, settings.dayStartMin, settings.timezone);
  const rangeEnd = zonedTimeToUtc(dateKey, settings.dayEndMin, settings.timezone);
  const candidates = buildCandidateSlots({
    dateKey,
    timeZone: settings.timezone,
    dayStartMin: settings.dayStartMin,
    dayEndMin: settings.dayEndMin,
    durationMins: settings.durationMins,
    now,
  });
  let busy: { start: Date; end: Date }[] = [];
  try {
    busy = await freeBusy(rangeStart, rangeEnd, settings.timezone);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Calendar is unavailable.";
    throw new DemoError(message.includes("not connected") ? "Demo calendar is not connected yet." : message, 503);
  }
  const bookings = await prisma.demoBooking.findMany({
    where: {
      status: "BOOKED",
      startsAt: { lt: rangeEnd },
      endsAt: { gt: rangeStart },
    },
    select: { startsAt: true, endsAt: true },
  });
  const bufferMs = settings.bufferMins * 60_000;
  const blocked = [...busy, ...bookings.map((row) => ({ start: row.startsAt, end: row.endsAt }))].map((interval) =>
    expandInterval(interval, bufferMs),
  );
  const slots = availableSlots(candidates, blocked).map((slot) => ({
    startsAt: slot.start.toISOString(),
    endsAt: slot.end.toISOString(),
    label: formatSlotLabel(slot.start, settings.timezone),
  }));
  return {
    date: dateKey,
    timezone: settings.timezone,
    durationMins: settings.durationMins,
    lookAheadDays: settings.lookAheadDays,
    slots,
  };
}

export async function bookDemo(input: {
  name: string;
  email: string;
  phone?: string | null;
  organization?: string | null;
  notes?: string | null;
  startsAt: string;
}) {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const phone = input.phone?.trim() || null;
  const organization = input.organization?.trim() || null;
  const notes = input.notes?.trim() || null;
  if (name.length < 2 || name.length > 80) throw new DemoError("Enter your name.", 400);
  if (!EMAIL_RE.test(email) || email.length > 160) throw new DemoError("Enter a valid email.", 400);
  if (phone && phone.length > 20) throw new DemoError("Phone number is too long.", 400);
  if (organization && organization.length > 120) throw new DemoError("Organisation name is too long.", 400);
  if (notes && notes.length > 500) throw new DemoError("Notes are too long.", 400);
  const start = new Date(input.startsAt);
  if (Number.isNaN(start.getTime())) throw new DemoError("Choose a time slot.", 400);

  const settings = await getDemoSettings();
  const dateKey = dateKeyInZone(start, settings.timezone);
  const open = await listSlotsForDate(dateKey);
  const match = open.slots.find((slot) => Math.abs(new Date(slot.startsAt).getTime() - start.getTime()) < 1000);
  if (!match) throw new DemoError("That slot is no longer available.", 409);
  const endsAt = new Date(match.endsAt);
  const cancelToken = randomBytes(24).toString("base64url");

  let booking;
  try {
    booking = await prisma.demoBooking.create({
      data: {
        name,
        email,
        phone,
        organization,
        notes,
        startsAt: new Date(match.startsAt),
        endsAt,
        cancelToken,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new DemoError("That slot was just booked.", 409);
    }
    throw error;
  }

  let createdEventId: string | null = null;
  try {
    const event = await createDemoEvent({
      name,
      email,
      organization,
      start: booking.startsAt,
      end: booking.endsAt,
      timeZone: settings.timezone,
      notes,
    });
    createdEventId = event.eventId;
    booking = await prisma.demoBooking.update({
      where: { id: booking.id },
      data: { googleEventId: event.eventId, meetLink: event.meetLink },
    });
  } catch (error) {
    if (createdEventId) await deleteDemoEvent(createdEventId).catch(() => undefined);
    await prisma.demoBooking.delete({ where: { id: booking.id } }).catch(() => undefined);
    const message = error instanceof Error ? error.message : "Could not add the calendar event.";
    throw new DemoError(message, 502);
  }

  const cancelUrl = `${publicBaseUrl()}/demo/cancel?token=${encodeURIComponent(booking.cancelToken)}`;
  const emailWarnings = await sendBookingEmails({
    name: booking.name,
    email: booking.email,
    organization: booking.organization,
    phone: booking.phone,
    notes: booking.notes,
    start: booking.startsAt,
    end: booking.endsAt,
    timeZone: settings.timezone,
    cancelUrl,
    meetLink: booking.meetLink,
    notifyEmail: notifyAddress(settings.notifyEmail),
    uid: booking.id,
  });

  return {
    id: booking.id,
    cancelToken: booking.cancelToken,
    startsAt: booking.startsAt.toISOString(),
    endsAt: booking.endsAt.toISOString(),
    meetLink: booking.meetLink,
    emailWarning: emailWarnings[0] ?? null,
  };
}

export async function getBookingByToken(token: string) {
  const booking = await prisma.demoBooking.findUnique({ where: { cancelToken: token } });
  if (!booking) return null;
  const settings = await getDemoSettings();
  return {
    name: booking.name,
    email: booking.email,
    organization: booking.organization,
    startsAt: booking.startsAt.toISOString(),
    endsAt: booking.endsAt.toISOString(),
    status: booking.status,
    meetLink: booking.meetLink,
    timezone: settings.timezone,
    label: new Intl.DateTimeFormat("en-IN", {
      timeZone: settings.timezone,
      dateStyle: "full",
      timeStyle: "short",
    }).format(booking.startsAt),
  };
}

export async function cancelDemoByToken(token: string) {
  const booking = await prisma.demoBooking.findUnique({ where: { cancelToken: token } });
  if (!booking || booking.status !== "BOOKED") {
    throw new DemoError("This demo cannot be cancelled.", 404);
  }
  return cancelBookingRecord(booking.id);
}

export async function cancelDemoById(id: string) {
  const booking = await prisma.demoBooking.findUnique({ where: { id } });
  if (!booking || booking.status !== "BOOKED") {
    throw new DemoError("This demo cannot be cancelled.", 404);
  }
  return cancelBookingRecord(booking.id);
}

async function cancelBookingRecord(id: string) {
  const booking = await prisma.demoBooking.findUnique({ where: { id } });
  if (!booking) throw new DemoError("Booking not found.", 404);
  if (booking.googleEventId) {
    try {
      await deleteDemoEvent(booking.googleEventId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not remove the calendar event.";
      throw new DemoError(message, 502);
    }
  }
  const updated = await prisma.demoBooking.update({
    where: { id },
    data: { status: "CANCELLED" },
  });
  const settings = await getDemoSettings();
  const cancelUrl = `${publicBaseUrl()}/demo/cancel?token=${encodeURIComponent(updated.cancelToken)}`;
  await sendBookingEmails({
    name: updated.name,
    email: updated.email,
    organization: updated.organization,
    phone: updated.phone,
    notes: updated.notes,
    start: updated.startsAt,
    end: updated.endsAt,
    timeZone: settings.timezone,
    cancelUrl,
    meetLink: updated.meetLink,
    notifyEmail: notifyAddress(settings.notifyEmail),
    uid: updated.id,
    cancelled: true,
  });
  return { ok: true };
}

export async function completeDemo(id: string) {
  const booking = await prisma.demoBooking.findUnique({ where: { id } });
  if (!booking || booking.status !== "BOOKED") {
    throw new DemoError("Only a booked demo can be marked complete.", 400);
  }
  await prisma.demoBooking.update({ where: { id }, data: { status: "COMPLETED" } });
  return { ok: true };
}
