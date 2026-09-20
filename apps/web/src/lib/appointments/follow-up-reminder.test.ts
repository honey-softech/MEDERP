import { describe, expect, it } from "vitest";
import {
  FOLLOW_UP_REMINDER_HOUR,
  followUpReminderEnabled,
  followUpReminderHint,
  followUpReminderSendAt,
  parseFollowUpReminderDaysBefore,
} from "@/lib/appointments/follow-up-reminder";

describe("follow-up reminder policy", () => {
  it("only accepts 1 or 2 days before, defaulting to 1", () => {
    expect(parseFollowUpReminderDaysBefore(1)).toBe(1);
    expect(parseFollowUpReminderDaysBefore(2)).toBe(2);
    expect(parseFollowUpReminderDaysBefore(3)).toBe(1);
    expect(parseFollowUpReminderDaysBefore(undefined)).toBe(1);
  });

  it("stays off until the hospital admin enables it", () => {
    expect(followUpReminderEnabled({})).toBe(false);
    expect(followUpReminderEnabled({ followUpReminderEnabled: false })).toBe(false);
    expect(followUpReminderEnabled({ followUpReminderEnabled: true })).toBe(true);
    expect(followUpReminderHint({ followUpReminderEnabled: true, followUpReminderDaysBefore: 2 })).toBe(
      "Patients get a WhatsApp reminder 2 days before the follow-up.",
    );
    expect(followUpReminderHint({ followUpReminderEnabled: false })).toBeNull();
  });

  it("skips reminders when the follow-up is today or already past", () => {
    const now = new Date(2026, 8, 20, 11, 0, 0);
    expect(followUpReminderSendAt(new Date(2026, 8, 20, 16, 0, 0), 1, now)).toBeNull();
    expect(followUpReminderSendAt(new Date(2026, 8, 19, 9, 0, 0), 1, now)).toBeNull();
  });

  it("schedules 1 or 2 calendar days before at 9:00", () => {
    const now = new Date(2026, 8, 20, 11, 0, 0);
    const visit = new Date(2026, 8, 27, 15, 30, 0);
    const oneDay = followUpReminderSendAt(visit, 1, now);
    const twoDays = followUpReminderSendAt(visit, 2, now);
    expect(oneDay).toEqual(new Date(2026, 8, 26, FOLLOW_UP_REMINDER_HOUR, 0, 0));
    expect(twoDays).toEqual(new Date(2026, 8, 25, FOLLOW_UP_REMINDER_HOUR, 0, 0));
  });

  it("sends immediately when the reminder window has already started", () => {
    const now = new Date(2026, 8, 20, 11, 0, 0);
    const tomorrow = new Date(2026, 8, 21, 10, 0, 0);
    const sendAt = followUpReminderSendAt(tomorrow, 1, now);
    expect(sendAt?.getTime()).toBe(now.getTime());
    const twoDaysAgoWindow = followUpReminderSendAt(tomorrow, 2, now);
    expect(twoDaysAgoWindow?.getTime()).toBe(now.getTime());
  });
});
