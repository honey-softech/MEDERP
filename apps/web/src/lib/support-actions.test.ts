import { describe, expect, it } from "vitest";
import {
  canRunSupportAction,
  isSupportTierAction,
  SUPPORT_ACTIONS,
  supportActionLabel,
} from "@/lib/support-actions";

describe("support actions catalog", () => {
  it("allows software admin and helpdesk agents to run support-tier actions", () => {
    expect(canRunSupportAction("SOFTWARE_ADMIN")).toBe(true);
    expect(canRunSupportAction("HELPDESK")).toBe(true);
    expect(canRunSupportAction("SUPER_ADMIN")).toBe(false);
  });

  it("tags account fixes as support and commercial tools as admin", () => {
    expect(SUPPORT_ACTIONS.find((row) => row.id === "RESET_PASSWORD")?.tier).toBe("support");
    expect(SUPPORT_ACTIONS.find((row) => row.id === "EXTEND_TRIAL")?.tier).toBe("admin");
    expect(isSupportTierAction("RESET_PASSWORD")).toBe(true);
    expect(isSupportTierAction("EXTEND_TRIAL")).toBe(false);
    expect(supportActionLabel("CLEAR_OTP_LOCK")).toBe("Clear OTP lockout");
  });
});
