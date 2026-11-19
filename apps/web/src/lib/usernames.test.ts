import { describe, expect, it } from "vitest";
import { humanizeLoginHandle } from "@/lib/display";
import { stripUsernameRoleSuffix, suggestedUsername } from "@/lib/usernames";

describe("suggestedUsername", () => {
  it("keeps the role tag separate from the name", () => {
    expect(suggestedUsername("Nurse", "", "NURSE")).toBe("nurse.nur");
    expect(suggestedUsername("Receptionist", "", "RECEPTIONIST")).toBe("receptionist.rec");
    expect(suggestedUsername("Dhanush", "", "SUPER_ADMIN")).toBe("dhanush.adm");
    expect(suggestedUsername("Ravi", "Kumar", "DOCTOR")).toBe("ravikumar.doc");
    expect(suggestedUsername("Lab", "Tech", "LAB_TECH")).toBe("labtech.lab");
    expect(suggestedUsername("Accounts", "", "ACCOUNTANT")).toBe("accounts.acc");
    expect(suggestedUsername("Pharma", "", "PHARMACIST")).toBe("pharma.phr");
    expect(suggestedUsername("Help", "Desk", "HELPDESK")).toBe("helpdesk.hdk");
  });

  it("keeps the role tag when the name is very long", () => {
    const username = suggestedUsername("a".repeat(80), "", "NURSE");
    expect(username.endsWith(".nur")).toBe(true);
    expect(username.length).toBeLessThanOrEqual(48);
  });
});

describe("stripUsernameRoleSuffix", () => {
  it("reads dotted handles and older glued handles", () => {
    expect(stripUsernameRoleSuffix("nurse.nur")).toBe("nurse");
    expect(stripUsernameRoleSuffix("receptionist.rec")).toBe("receptionist");
    expect(stripUsernameRoleSuffix("dhanush.adm")).toBe("dhanush");
    expect(stripUsernameRoleSuffix("nursenur")).toBe("nurse");
    expect(stripUsernameRoleSuffix("dhanushadm")).toBe("dhanush");
    expect(stripUsernameRoleSuffix("priyasharmadoc2")).toBe("priyasharma");
    expect(stripUsernameRoleSuffix("nurse.nur.2")).toBe("nurse");
  });
});

describe("humanizeLoginHandle", () => {
  it("prints the person, not the role tag", () => {
    expect(humanizeLoginHandle("nurse.nur")).toBe("Nurse");
    expect(humanizeLoginHandle("receptionist.rec")).toBe("Receptionist");
    expect(humanizeLoginHandle("dhanush.adm")).toBe("Dhanush");
    expect(humanizeLoginHandle("nursenur")).toBe("Nurse");
    expect(humanizeLoginHandle("ravikumar.doc.2")).toBe("Ravikumar");
  });
});
