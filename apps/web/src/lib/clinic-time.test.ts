import { describe, expect, it } from "vitest";
import { formatClinicDateTime, formatReminderClock, formatVisitSummaryWhen } from "@/lib/clinic-time";

describe("clinic time", () => {
  it("prints a UTC instant as India time", () => {
    expect(formatClinicDateTime(new Date("2026-10-28T09:45:00.000Z"))).toBe("28 Oct 2026, 3:15 pm");
  });

  it("uses India time for a walk-in visit summary", () => {
    const at = new Date("2026-10-28T09:45:00.000Z");
    expect(
      formatVisitSummaryWhen({
        queueType: "WALK_IN",
        scheduledAt: at,
        checkInAt: at,
      }),
    ).toBe("28 Oct 2026, 3:15 pm");
  });

  it("keeps a date-only follow-up on that day and uses the booked visit clock", () => {
    const clock = formatReminderClock(new Date("2026-11-04T00:00:00.000Z"), new Date("2026-10-28T09:45:00.000Z"));
    expect(clock.date).toBe("4 Nov 2026");
    expect(clock.time).toBe("3:15 pm");
    expect(clock.when).toBe("4 Nov 2026, 3:15 pm");
  });

  it("uses India time for a timed appointment reminder", () => {
    const clock = formatReminderClock(new Date("2026-10-28T09:45:00.000Z"));
    expect(clock.date).toBe("28 Oct 2026");
    expect(clock.time).toBe("3:15 pm");
  });

  it("uses the check-in instant for a booked visit", () => {
    expect(
      formatVisitSummaryWhen({
        queueType: "SCHEDULED",
        scheduledAt: new Date("2026-10-28T10:30:00.000Z"),
        checkInAt: new Date("2026-10-28T05:02:00.000Z"),
      }),
    ).toBe("28 Oct 2026, 10:32 am");
  });
});
