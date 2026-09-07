import { describe, expect, it } from "vitest";
import { templateComponents } from "@/lib/messaging/providers";

describe("WhatsApp template builder", () => {
  it("builds positional reminder parameters and requires PDF media for visit summary", () => {
    const reminder = templateComponents(
      {
        toPhone: "9876543210",
        channel: "WHATSAPP",
        body: "unused",
        templateKey: "appointment_reminder",
        variables: {
          patient: "Ravi",
          doctor: "Dr Sharma",
          date: "5 Sep 2026",
          time: "10:30 am",
        },
      },
      false,
    );
    expect(reminder).toEqual([
      {
        type: "body",
        parameters: [
          { type: "text", text: "Ravi" },
          { type: "text", text: "Dr Sharma" },
          { type: "text", text: "5 Sep 2026" },
          { type: "text", text: "10:30 am" },
        ],
      },
    ]);

    const missingPdf = templateComponents(
      {
        toPhone: "9876543210",
        channel: "WHATSAPP",
        body: "unused",
        templateKey: "visit_summary",
        variables: { patient: "Ravi", hospital: "City Clinic", doctor: "Dr Sharma", when: "5 Sep 2026" },
      },
      false,
    );
    expect(missingPdf).toEqual({ error: "Visit summary PDF media id is missing." });
  });

  it("requires an OTP value for the authentication template", () => {
    expect(
      templateComponents(
        { toPhone: "9876543210", channel: "WHATSAPP", body: "unused", templateKey: "otp" },
        false,
      ),
    ).toEqual({ error: "OTP value missing for WhatsApp send." });

    const otp = templateComponents(
      {
        toPhone: "9876543210",
        channel: "WHATSAPP",
        body: "unused",
        templateKey: "otp",
        otp: "123456",
      },
      false,
    );
    expect(otp).toEqual([
      { type: "body", parameters: [{ type: "text", text: "123456" }] },
    ]);
  });
});
