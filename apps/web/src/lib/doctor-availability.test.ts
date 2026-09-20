import { describe, expect, it } from "vitest";
import {
  clampNowToWindow,
  remainingWalkInWindows,
  resolveWalkInScheduledAt,
  walkInMustBeToday,
} from "@/lib/doctor-availability";

const morning = { dayOfWeek: 0, startMinute: 9 * 60, endMinute: 13 * 60 };
const evening = { dayOfWeek: 0, startMinute: 16 * 60, endMinute: 20 * 60 };
const sunday = (hour: number, minute = 0) => new Date(2026, 8, 20, hour, minute, 0); // Sunday

describe("walk-in availability", () => {
  it("only allows walk-ins on the same calendar day", () => {
    const now = sunday(11);
    expect(walkInMustBeToday(sunday(10), now)).toBeNull();
    expect(walkInMustBeToday(new Date(2026, 8, 21, 10, 0, 0), now)).toBe(
      "Walk-ins can only be added for today.",
    );
  });

  it("drops windows that have already ended", () => {
    expect(remainingWalkInWindows([morning, evening], sunday(11)).map((row) => row.startMinute)).toEqual([
      9 * 60,
      16 * 60,
    ]);
    expect(remainingWalkInWindows([morning, evening], sunday(14)).map((row) => row.startMinute)).toEqual([
      16 * 60,
    ]);
    expect(remainingWalkInWindows([morning, evening], sunday(20)).map((row) => row.startMinute)).toEqual([]);
  });

  it("uses now when the doctor has no availability windows", () => {
    const now = sunday(11, 15);
    const resolved = resolveWalkInScheduledAt({ now, windows: [] });
    expect(resolved.ok).toBe(true);
    if (resolved.ok) expect(resolved.at).toEqual(now);
  });

  it("puts a single remaining window walk-in at now, or at window start if it has not opened", () => {
    const during = resolveWalkInScheduledAt({ now: sunday(11), windows: [morning] });
    expect(during.ok).toBe(true);
    if (during.ok) expect(during.at).toEqual(sunday(11));

    const before = resolveWalkInScheduledAt({ now: sunday(8), windows: [morning] });
    expect(before.ok).toBe(true);
    if (before.ok) expect(before.at).toEqual(sunday(9));
  });

  it("requires a chosen session when more than one window remains", () => {
    const missing = resolveWalkInScheduledAt({ now: sunday(11), windows: [morning, evening] });
    expect(missing).toEqual({
      ok: false,
      error: "This doctor has more than one session today. Choose a walk-in time.",
    });

    const eveningPick = resolveWalkInScheduledAt({
      now: sunday(11),
      windows: [morning, evening],
      chosenStartMinute: 16 * 60,
    });
    expect(eveningPick.ok).toBe(true);
    if (eveningPick.ok) expect(eveningPick.at).toEqual(sunday(16));

    const morningPick = resolveWalkInScheduledAt({
      now: sunday(11),
      windows: [morning, evening],
      chosenStartMinute: 9 * 60,
    });
    expect(morningPick.ok).toBe(true);
    if (morningPick.ok) expect(morningPick.at).toEqual(sunday(11));
  });

  it("still allows a walk-in after the last window ends, using the current time", () => {
    const now = sunday(20, 5);
    const resolved = resolveWalkInScheduledAt({ now, windows: [morning, evening] });
    expect(resolved.ok).toBe(true);
    if (resolved.ok) expect(resolved.at).toEqual(now);
  });

  it("blocks a walk-in when the doctor has no window today", () => {
    const mondayOnly = { dayOfWeek: 1, startMinute: 9 * 60, endMinute: 13 * 60 };
    expect(resolveWalkInScheduledAt({ now: sunday(11), windows: [mondayOnly] })).toEqual({
      ok: false,
      error: "This doctor has no availability windows today.",
    });
  });

  it("clamps a late now to the last minute of the window", () => {
    expect(clampNowToWindow(sunday(13), morning)).toEqual(sunday(12, 59));
  });
});
