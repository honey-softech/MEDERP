import { describe, expect, it } from "vitest";
import { assignDayTokens, onDifferentTokenDay, type DayTokenVisit } from "@/lib/appointments/day-tokens";

function visit(partial: Partial<DayTokenVisit> & Pick<DayTokenVisit, "id" | "scheduledAt">): DayTokenVisit {
  return {
    createdAt: partial.createdAt ?? partial.scheduledAt,
    queueType: partial.queueType ?? "SCHEDULED",
    status: partial.status ?? "SCHEDULED",
    ...partial,
  };
}

describe("day appointment tokens", () => {
  it("numbers scheduled visits by time from the start of the day across sessions", () => {
    const day = new Date(2026, 10, 20);
    const evening = visit({
      id: "evening",
      scheduledAt: new Date(2026, 10, 20, 16, 0),
      createdAt: new Date(2026, 10, 1, 9, 0),
    });
    const morning = visit({
      id: "morning",
      scheduledAt: new Date(2026, 10, 20, 9, 0),
      createdAt: new Date(2026, 10, 18, 9, 0),
    });
    const mid = visit({
      id: "mid",
      scheduledAt: new Date(2026, 10, 20, 10, 0),
      createdAt: new Date(2026, 10, 19, 9, 0),
    });

    expect(assignDayTokens([evening, morning, mid])).toEqual([
      { id: "morning", tokenNumber: 1 },
      { id: "mid", tokenNumber: 2 },
      { id: "evening", tokenNumber: 3 },
    ]);
    expect(onDifferentTokenDay(day, morning.scheduledAt)).toBe(false);
  });

  it("gives walk-ins tokens only after every scheduled visit", () => {
    const scheduled = visit({ id: "booked", scheduledAt: new Date(2026, 10, 20, 16, 0) });
    const earlierWalkIn = visit({
      id: "walk-early",
      queueType: "WALK_IN",
      scheduledAt: new Date(2026, 10, 20, 11, 0),
      createdAt: new Date(2026, 10, 20, 11, 0),
    });
    const laterWalkIn = visit({
      id: "walk-late",
      queueType: "WALK_IN",
      scheduledAt: new Date(2026, 10, 20, 17, 0),
      createdAt: new Date(2026, 10, 20, 17, 0),
    });

    expect(assignDayTokens([laterWalkIn, earlierWalkIn, scheduled])).toEqual([
      { id: "booked", tokenNumber: 1 },
      { id: "walk-early", tokenNumber: 2 },
      { id: "walk-late", tokenNumber: 3 },
    ]);
  });

  it("keeps late evening and the next morning on different local token days", () => {
    const evening = new Date(2026, 9, 31, 23, 30);
    const nextMorning = new Date(2026, 10, 1, 0, 30);
    expect(onDifferentTokenDay(evening, nextMorning)).toBe(true);
    expect(onDifferentTokenDay(evening, new Date(2026, 9, 31, 9, 0))).toBe(false);
  });

  it("drops cancelled and no-show visits from the sequence", () => {
    const kept = visit({ id: "kept", scheduledAt: new Date(2026, 10, 20, 10, 0) });
    const cancelled = visit({
      id: "cancelled",
      status: "CANCELLED",
      scheduledAt: new Date(2026, 10, 20, 9, 0),
    });
    const missed = visit({
      id: "missed",
      status: "NO_SHOW",
      scheduledAt: new Date(2026, 10, 20, 9, 30),
    });
    expect(assignDayTokens([cancelled, missed, kept])).toEqual([{ id: "kept", tokenNumber: 1 }]);
  });
});
