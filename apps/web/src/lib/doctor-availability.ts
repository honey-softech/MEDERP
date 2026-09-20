import { prisma } from "@/lib/prisma";
import { doctorIsOnLeave, isSameCalendarDay } from "@/lib/opd/scheduling";

export const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export type AvailabilityWindowInput = {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
};

export type AvailabilityWindowRow = AvailabilityWindowInput & { id?: string };

const DEFAULT_SLOT_MINUTES = 15;

export function parseTimeToMinute(value: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? "").trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

export function minuteToTimeLabel(minute: number) {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function normalizeAvailabilityWindows(raw: unknown): { ok: true; windows: AvailabilityWindowInput[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) {
    return { ok: false, error: "Availability windows must be a list." };
  }
  const windows: AvailabilityWindowInput[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") {
      return { ok: false, error: "Each availability window must be an object." };
    }
    const item = row as Record<string, unknown>;
    const dayOfWeek = Number(item.dayOfWeek);
    const startMinute =
      item.startMinute != null
        ? Number(item.startMinute)
        : parseTimeToMinute(String(item.startTime ?? item.start ?? ""));
    const endMinute =
      item.endMinute != null
        ? Number(item.endMinute)
        : parseTimeToMinute(String(item.endTime ?? item.end ?? ""));

    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      return { ok: false, error: "Day of week must be 0 (Sunday) through 6 (Saturday)." };
    }
    if (
      startMinute == null ||
      endMinute == null ||
      !Number.isInteger(startMinute) ||
      !Number.isInteger(endMinute)
    ) {
      return { ok: false, error: "Enter start and end times as HH:MM." };
    }
    if (startMinute < 0 || startMinute >= 24 * 60 || endMinute <= 0 || endMinute > 24 * 60) {
      return { ok: false, error: "Availability times must be within the same day (00:00–24:00)." };
    }
    if (endMinute <= startMinute) {
      return { ok: false, error: "End time must be after start time for each window." };
    }
    windows.push({ dayOfWeek, startMinute, endMinute });
  }

  // Reject overlapping windows on the same day.
  const byDay = new Map<number, AvailabilityWindowInput[]>();
  for (const window of windows) {
    const list = byDay.get(window.dayOfWeek) ?? [];
    list.push(window);
    byDay.set(window.dayOfWeek, list);
  }
  for (const [day, list] of byDay) {
    const sorted = [...list].sort((a, b) => a.startMinute - b.startMinute);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].startMinute < sorted[i - 1].endMinute) {
        return {
          ok: false,
          error: `Overlapping availability windows on ${DAY_LABELS[day]}.`,
        };
      }
    }
  }

  return { ok: true, windows };
}

export async function listDoctorAvailability(staffId: string) {
  return prisma.staffAvailabilityWindow.findMany({
    where: { staffId },
    orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }],
  });
}

export async function replaceDoctorAvailability(staffId: string, windows: AvailabilityWindowInput[]) {
  await prisma.$transaction([
    prisma.staffAvailabilityWindow.deleteMany({ where: { staffId } }),
    ...(windows.length
      ? [
          prisma.staffAvailabilityWindow.createMany({
            data: windows.map((window) => ({
              staffId,
              dayOfWeek: window.dayOfWeek,
              startMinute: window.startMinute,
              endMinute: window.endMinute,
            })),
          }),
        ]
      : []),
  ]);
  return listDoctorAvailability(staffId);
}

export async function doctorHasAvailabilityConfigured(staffId: string) {
  const count = await prisma.staffAvailabilityWindow.count({ where: { staffId } });
  return count > 0;
}

export function minuteOfDay(at: Date) {
  return at.getHours() * 60 + at.getMinutes();
}

export function applyMinuteOnDay(day: Date, minute: number) {
  const next = new Date(day);
  next.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
  return next;
}

export function windowsForWeekday(windows: AvailabilityWindowInput[], dayOfWeek: number) {
  return windows.filter((window) => window.dayOfWeek === dayOfWeek).sort((a, b) => a.startMinute - b.startMinute);
}

/** Windows on `now`'s weekday that have not fully ended yet. */
export function remainingWalkInWindows(windows: AvailabilityWindowInput[], now = new Date()) {
  const minute = minuteOfDay(now);
  return windowsForWeekday(windows, now.getDay()).filter((window) => window.endMinute > minute);
}

export function clampNowToWindow(now: Date, window: AvailabilityWindowInput) {
  const start = applyMinuteOnDay(now, window.startMinute);
  if (now.getTime() <= start.getTime()) return start;
  const end = applyMinuteOnDay(now, window.endMinute);
  if (now.getTime() >= end.getTime()) {
    const last = new Date(end);
    last.setMinutes(last.getMinutes() - 1);
    return last;
  }
  return new Date(now);
}

export function resolveWalkInScheduledAt(params: {
  now?: Date;
  windows: AvailabilityWindowInput[];
  chosenStartMinute?: number | null;
}): { ok: true; at: Date } | { ok: false; error: string } {
  const now = params.now ?? new Date();
  if (params.windows.length === 0) {
    return { ok: true, at: now };
  }

  const remaining = remainingWalkInWindows(params.windows, now);
  if (remaining.length === 0) {
    const todayWindows = windowsForWeekday(params.windows, now.getDay());
    if (todayWindows.length > 0) {
      return { ok: true, at: now };
    }
    return { ok: false, error: "This doctor has no availability windows today." };
  }

  let window = remaining[0];
  if (remaining.length > 1) {
    const chosen = params.chosenStartMinute;
    if (chosen == null || !Number.isInteger(chosen)) {
      return {
        ok: false,
        error: "This doctor has more than one session today. Choose a walk-in time.",
      };
    }
    const matched =
      remaining.find((row) => row.startMinute === chosen) ??
      remaining.find((row) => chosen >= row.startMinute && chosen < row.endMinute);
    if (!matched) {
      return { ok: false, error: "Choose a walk-in time within today's remaining hours." };
    }
    window = matched;
  }

  return { ok: true, at: clampNowToWindow(now, window) };
}

export function walkInMustBeToday(at: Date, now = new Date()) {
  if (isSameCalendarDay(at, now)) return null;
  return "Walk-ins can only be added for today.";
}

/** True when `at` falls inside any configured window for that weekday. */
export function instantInWindows(at: Date, windows: AvailabilityWindowInput[]) {
  const day = at.getDay();
  const minute = minuteOfDay(at);
  return windows.some(
    (window) => window.dayOfWeek === day && minute >= window.startMinute && minute < window.endMinute,
  );
}

export async function assertDoctorBookableAt(params: {
  hospitalId: string;
  doctorId: string;
  at: Date;
  /** Walk-ins may skip window checks when no windows are configured; still block leave. */
  queueType?: string;
}) {
  if (await doctorIsOnLeave(params.hospitalId, params.doctorId, params.at)) {
    return { ok: false as const, error: "Doctor is on leave that day.", status: 409 as const };
  }

  const windows = await listDoctorAvailability(params.doctorId);
  if (windows.length === 0 || params.queueType === "WALK_IN") {
    // No structured hours, or a walk-in after hours — still block leave above.
    return { ok: true as const };
  }

  if (!instantInWindows(params.at, windows)) {
    const dayWindows = windows.filter((w) => w.dayOfWeek === params.at.getDay());
    const hint =
      dayWindows.length === 0
        ? `${DAY_LABELS[params.at.getDay()]} has no availability windows for this doctor.`
        : `Available: ${dayWindows.map((w) => `${minuteToTimeLabel(w.startMinute)}–${minuteToTimeLabel(w.endMinute)}`).join(", ")}.`;
    return {
      ok: false as const,
      error: `Chosen time is outside the doctor's availability. ${hint}`,
      status: 400 as const,
    };
  }

  return { ok: true as const };
}

export function buildSlotLabelsForDay(
  windows: AvailabilityWindowInput[],
  dayOfWeek: number,
  slotMinutes = DEFAULT_SLOT_MINUTES,
) {
  const dayWindows = windows
    .filter((w) => w.dayOfWeek === dayOfWeek)
    .sort((a, b) => a.startMinute - b.startMinute);
  const slots: { minute: number; label: string }[] = [];
  for (const window of dayWindows) {
    for (let minute = window.startMinute; minute + slotMinutes <= window.endMinute; minute += slotMinutes) {
      slots.push({ minute, label: minuteToTimeLabel(minute) });
    }
  }
  return slots;
}

export async function listSlotsForDoctorDate(params: {
  doctorId: string;
  dateIso: string; // YYYY-MM-DD in local hospital sense — treat as local calendar date
  slotMinutes?: number;
}) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(params.dateIso.trim());
  if (!match) return { ok: false as const, error: "Use date as YYYY-MM-DD." };

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (Number.isNaN(probe.getTime())) return { ok: false as const, error: "Invalid date." };

  const windows = await listDoctorAvailability(params.doctorId);
  const dayOfWeek = probe.getDay();
  const slots = buildSlotLabelsForDay(windows, dayOfWeek, params.slotMinutes ?? DEFAULT_SLOT_MINUTES);

  return {
    ok: true as const,
    dayOfWeek,
    dayLabel: DAY_LABELS[dayOfWeek],
    configured: windows.length > 0,
    windows: windows
      .filter((w) => w.dayOfWeek === dayOfWeek)
      .map((w) => ({
        startMinute: w.startMinute,
        endMinute: w.endMinute,
        startTime: minuteToTimeLabel(w.startMinute),
        endTime: minuteToTimeLabel(w.endMinute),
      })),
    slots,
  };
}
