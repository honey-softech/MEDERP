import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

import { issueVisitEditUnlock, readVisitEditUnlockToken } from "@/lib/appointments/visit-edit-unlock";

describe("past visit edit unlock", () => {
  it("accepts a token only for the same doctor and visit, before it expires", () => {
    const now = Date.parse("2026-03-20T10:00:00Z");
    const issued = issueVisitEditUnlock({
      userId: "user-1",
      appointmentId: "visit-1",
      reason: "Corrected the diagnosis after the lab report",
      now,
    });

    expect(
      readVisitEditUnlockToken(issued.token, { userId: "user-1", appointmentId: "visit-1" }, now + 1000),
    ).toEqual({
      reason: "Corrected the diagnosis after the lab report",
      expiresAt: now + 15 * 60 * 1000,
    });
    expect(
      readVisitEditUnlockToken(issued.token, { userId: "user-2", appointmentId: "visit-1" }, now + 1000),
    ).toBeNull();
    expect(
      readVisitEditUnlockToken(issued.token, { userId: "user-1", appointmentId: "visit-1" }, now + 16 * 60 * 1000),
    ).toBeNull();
    expect(readVisitEditUnlockToken(`${issued.token}x`, { userId: "user-1", appointmentId: "visit-1" }, now)).toBeNull();
  });
});
