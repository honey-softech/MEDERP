import { describe, expect, it } from "vitest";
import { deviceTokenFromLogoutBody, partitionPushTokens } from "@/lib/device-push";

describe("device push sessions", () => {
  const now = new Date("2026-10-28T12:00:00.000Z");

  it("keeps only tokens whose sign-in session is still active", () => {
    const { live, staleIds } = partitionPushTokens(
      [
        { id: "live", sessionExpiresAt: new Date("2026-10-29T12:00:00.000Z") },
        { id: "signed-out", sessionExpiresAt: null },
        { id: "expired", sessionExpiresAt: new Date("2026-10-27T12:00:00.000Z") },
      ],
      now,
    );
    expect(live.map((row) => row.id)).toEqual(["live"]);
    expect(staleIds).toEqual(["signed-out", "expired"]);
  });

  it("reads a device token from sign-out and ignores anything else", () => {
    expect(deviceTokenFromLogoutBody({ deviceToken: "a".repeat(20) })).toBe("a".repeat(20));
    expect(deviceTokenFromLogoutBody({})).toBe("");
    expect(deviceTokenFromLogoutBody(null)).toBe("");
    expect(deviceTokenFromLogoutBody({ deviceToken: "short" })).toBe("");
  });
});
