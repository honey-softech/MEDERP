import { addCalendarDays, dayRange, isSameCalendarDay } from "@/lib/opd/scheduling";

export const FOLLOW_UP_REMINDER_DAYS = [1, 2] as const;
export type FollowUpReminderDaysBefore = (typeof FOLLOW_UP_REMINDER_DAYS)[number];

export type FollowUpReminderPolicy = {
  followUpReminderEnabled?: boolean | null;
  followUpReminderDaysBefore?: number | null;
};

export function parseFollowUpReminderDaysBefore(value: unknown): FollowUpReminderDaysBefore {
  return Number(value) === 2 ? 2 : 1;
}

export function followUpReminderEnabled(policy?: FollowUpReminderPolicy | null) {
  return Boolean(policy?.followUpReminderEnabled);
}

/** 9:00 local on the calendar day the reminder should go out. */
export const FOLLOW_UP_REMINDER_HOUR = 9;

/**
 * When to send a follow-up reminder.
 * Returns null when the visit is today or in the past (too late to remind).
 * If the chosen day has already passed, returns `now` so the reminder goes out immediately.
 */
export function followUpReminderSendAt(
  visitAt: Date,
  daysBefore: number,
  now = new Date(),
): Date | null {
  const days = parseFollowUpReminderDaysBefore(daysBefore);
  const { start: visitDay } = dayRange(visitAt);
  const { start: today } = dayRange(now);
  if (visitDay.getTime() <= today.getTime()) return null;

  const sendDay = addCalendarDays(visitDay, -days);
  const sendAt = new Date(sendDay);
  sendAt.setHours(FOLLOW_UP_REMINDER_HOUR, 0, 0, 0);
  return sendAt.getTime() <= now.getTime() ? new Date(now) : sendAt;
}

export function followUpReminderHint(policy?: FollowUpReminderPolicy | null) {
  if (!followUpReminderEnabled(policy)) return null;
  const days = parseFollowUpReminderDaysBefore(policy?.followUpReminderDaysBefore);
  return days === 2
    ? "Patients get a WhatsApp reminder 2 days before the follow-up."
    : "Patients get a WhatsApp reminder 1 day before the follow-up.";
}

export function sameFollowUpVisitDay(left: Date, right: Date) {
  return isSameCalendarDay(left, right);
}
