import { describe, expect, it } from "vitest";
import { parseEmployeeBody } from "@/lib/employee";

describe("parseEmployeeBody", () => {
  it("requires first name and allows a blank last name", () => {
    expect(parseEmployeeBody({ firstName: "" }, "RECEPTIONIST")).toEqual({
      error: "First name is required.",
    });

    const parsed = parseEmployeeBody({ firstName: "Ravi", mobile: "9876543210" }, "RECEPTIONIST");
    expect("value" in parsed).toBe(true);
    if (!("value" in parsed)) return;
    expect(parsed.value.firstName).toBe("Ravi");
    expect(parsed.value.lastName).toBe("");
  });
});
