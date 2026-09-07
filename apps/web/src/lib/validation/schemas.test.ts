import { describe, expect, it } from "vitest";
import { loginSchema, signupSchema } from "@/lib/validation/auth";
import { appointmentPatchSchema, createAppointmentSchema } from "@/lib/validation/appointment";

describe("auth schemas", () => {
  it("rejects empty login credentials", () => {
    expect(loginSchema.safeParse({ mobile: "", password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ mobile: "9876543210", password: "secret" }).success).toBe(true);
  });

  it("rejects a short signup username", () => {
    const parsed = signupSchema.safeParse({
      username: "ab",
      mobile: "9876543210",
      password: "password1",
      role: "RECEPTIONIST",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("appointment schemas", () => {
  it("rejects an unknown PATCH action", () => {
    expect(appointmentPatchSchema.safeParse({ action: "delete" }).success).toBe(false);
    expect(appointmentPatchSchema.safeParse({ action: "checkin" }).success).toBe(true);
  });

  it("requires a valid reschedule time", () => {
    expect(appointmentPatchSchema.safeParse({ action: "reschedule", scheduledAt: "nope" }).success).toBe(
      false,
    );
    expect(
      appointmentPatchSchema.safeParse({ action: "reschedule", scheduledAt: "2026-09-07T10:30:00" }).success,
    ).toBe(true);
  });

  it("rejects an invalid visit type on create", () => {
    expect(
      createAppointmentSchema.safeParse({
        patientId: "p1",
        departmentId: "d1",
        visitType: "HOLIDAY",
      }).success,
    ).toBe(false);
  });
});
