import { describe, expect, it } from "vitest";
import { mederpWebHost, mederpWebUrl } from "./mobile-app";

describe("mederpWebUrl", () => {
  it("points registration and subscription at the public site", () => {
    expect(mederpWebUrl("/register-hospital")).toBe("https://mederp.co.in/register-hospital");
    expect(mederpWebUrl("hospital/subscription")).toBe("https://mederp.co.in/hospital/subscription");
  });
});

describe("mederpWebHost", () => {
  it("returns the public site hostname for the mobile manage-plan notice", () => {
    expect(mederpWebHost()).toBe("mederp.co.in");
  });
});
