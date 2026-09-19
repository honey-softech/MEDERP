import { describe, expect, it } from "vitest";
import {
  extraSessionIds,
  sessionExpiresAt,
  shouldRefreshSession,
} from "@/lib/session-policy";

describe("session policy", () => {
  it("keeps the two most recently seen sessions", () => {
    const phone = { id: "phone", lastSeenAt: new Date("2026-09-19T10:00:00") };
    const desk = { id: "desk", lastSeenAt: new Date("2026-09-19T12:00:00") };
    const tablet = { id: "tablet", lastSeenAt: new Date("2026-09-18T08:00:00") };
    expect(extraSessionIds([phone, desk, tablet])).toEqual(["tablet"]);
    expect(extraSessionIds([phone, desk])).toEqual([]);
  });

  it("expires 48 hours after last activity and throttles refreshes", () => {
    const start = new Date("2026-09-19T08:00:00");
    expect(sessionExpiresAt(start)).toEqual(new Date("2026-09-21T08:00:00"));
    expect(shouldRefreshSession(start, new Date("2026-09-19T08:04:00"))).toBe(false);
    expect(shouldRefreshSession(start, new Date("2026-09-19T08:05:00"))).toBe(true);
  });
});
