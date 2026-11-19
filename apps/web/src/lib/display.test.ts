import { describe, expect, it } from "vitest";
import {
  ageFromDateInput,
  ageYears,
  dateOfBirthFromAge,
  doctorName,
  isLoginHandleDisplayName,
  parsePatientAge,
  personLabel,
  printableDoctorLabel,
  printedPersonName,
} from "@/lib/display";

describe("patient age helpers", () => {
  it("parses whole years from 0 to 150 and rejects invalid values", () => {
    expect(parsePatientAge("0")).toBe(0);
    expect(parsePatientAge(40)).toBe(40);
    expect(parsePatientAge(" 12 ")).toBe(12);
    expect(parsePatientAge("")).toBeNull();
    expect(parsePatientAge("12.5")).toBeNull();
    expect(parsePatientAge("abc")).toBeNull();
    expect(parsePatientAge(151)).toBeNull();
  });

  it("derives a date of birth that still reports the same age", () => {
    const now = new Date(2026, 8, 20);
    const dob = dateOfBirthFromAge(35, now);
    expect(dob).toEqual(new Date(1991, 8, 20));
    expect(ageYears(dob, now)).toBe(35);
  });

  it("computes age from a date input without timezone shift", () => {
    expect(ageFromDateInput("1991-09-20", new Date(2026, 8, 20))).toBe("35");
    expect(ageFromDateInput("invalid")).toBeNull();
  });
});

describe("doctorName", () => {
  it("uses Doctor Name fields instead of login or email", () => {
    expect(
      doctorName({
        firstName: "john.doe",
        lastName: "",
        appUser: { username: "john.doe@clinic.com", firstName: "John", lastName: "Doe" },
      }),
    ).toBe("Dr. John Doe");
  });

  it("keeps a proper staff name when the account has none", () => {
    expect(
      doctorName({
        firstName: "Priya",
        lastName: "Sharma",
        appUser: { username: "priyasharmadoc" },
      }),
    ).toBe("Dr. Priya Sharma");
  });

  it("detects username-seeded staff labels", () => {
    expect(isLoginHandleDisplayName("john doe", "john.doe")).toBe(true);
    expect(isLoginHandleDisplayName("Priya Sharma", "priyasharmadoc")).toBe(false);
  });

  it("strips admin/doctor role tags from login-handle names on print", () => {
    expect(
      doctorName({
        firstName: "dhanushadm",
        lastName: "",
        appUser: { username: "dhanushadm" },
      }),
    ).toBe("Dr. Dhanush");
    expect(
      doctorName({
        firstName: null,
        lastName: null,
        appUser: { username: "priyasharmadoc" },
      }),
    ).toBe("Dr. Priyasharma");
    expect(printableDoctorLabel("Dr. dhanushadm")).toBe("Dr. Dhanush");
    expect(printableDoctorLabel("Dr. dhanush.adm")).toBe("Dr. Dhanush");
    expect(printableDoctorLabel("Dhanush Adm")).toBe("Dr. Dhanush");
    expect(doctorName({
      firstName: "dhanush.adm",
      lastName: "",
      appUser: { username: "dhanush.adm" },
    })).toBe("Dr. Dhanush");
  });

  it("prints the person's name without a role tag", () => {
    expect(printedPersonName("nurse.nur")).toBe("Nurse");
    expect(printedPersonName("receptionist.rec")).toBe("Receptionist");
    expect(printedPersonName("receptionistrec")).toBe("Receptionist");
    expect(printedPersonName("dhanush.adm")).toBe("Dhanush");
    expect(printedPersonName("Dr. dhanush.adm")).toBe("Dr. Dhanush");
    expect(printedPersonName("Priya Sharma")).toBe("Priya Sharma");
  });

  it("never shows a login handle as a person's name", () => {
    expect(
      personLabel({ firstName: "dhanushadm", lastName: "", username: "dhanushadm", role: "SUPER_ADMIN" }),
    ).toBe("Dhanush");
    expect(
      personLabel({
        firstName: "dhanushadm",
        lastName: "",
        username: "dhanushadm",
        role: "SUPER_ADMIN",
        staffRole: "DOCTOR",
      }),
    ).toBe("Dr. Dhanush");
    expect(personLabel({ username: "dhanushadm", role: "DOCTOR" })).toBe("Dr. Dhanush");
  });
});
