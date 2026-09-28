import { describe, expect, it } from "vitest";
import { availableSlots, buildCandidateSlots, expandInterval, zonedTimeToUtc } from "./slots";

describe("demo slots", () => {
  it("converts Asia/Kolkata wall time to UTC", () => {
    const start = zonedTimeToUtc("2026-09-28", 10 * 60, "Asia/Kolkata");
    expect(start.toISOString()).toBe("2026-09-28T04:30:00.000Z");
  });

  it("drops slots that overlap a buffered booking", () => {
    const candidates = buildCandidateSlots({
      dateKey: "2026-09-28",
      timeZone: "Asia/Kolkata",
      dayStartMin: 10 * 60,
      dayEndMin: 12 * 60,
      durationMins: 30,
      now: new Date("2026-09-28T00:00:00.000Z"),
    });
    expect(candidates).toHaveLength(4);
    const booked = candidates[0];
    const blocked = expandInterval(booked, 15 * 60_000);
    const open = availableSlots(candidates, [blocked]);
    expect(open.map((slot) => slot.start.toISOString())).toEqual([
      "2026-09-28T05:30:00.000Z",
      "2026-09-28T06:00:00.000Z",
    ]);
  });
});
