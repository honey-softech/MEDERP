import { describe, expect, it } from "vitest";
import { mederpWebUrl } from "./mobile-app";

describe("mederpWebUrl", () => {
  it("points registration and subscription at the public site", () => {
    expect(mederpWebUrl("/register-hospital")).toBe("https://mederp.co.in/register-hospital");
    expect(mederpWebUrl("hospital/subscription")).toBe("https://mederp.co.in/hospital/subscription");
  });
});
