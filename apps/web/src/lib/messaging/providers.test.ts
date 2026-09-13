import { describe, expect, it } from "vitest";
import { templateComponents } from "@/lib/messaging/providers";
import { reminderComponents } from "@/lib/messaging/whatsapp-meta-templates";

describe("WhatsApp template builder", () => {
  it("builds named utility reminder parameters and requires PDF media for visit summary", () => {
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
    expect(reminder).toEqual(
      reminderComponents(
        { patient: "Ravi", doctor: "Dr Sharma", date: "5 Sep 2026", time: "10:30 am" },
        "named",
      ),
    );

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

    const missingCertPdf = templateComponents(
      {
        toPhone: "9876543210",
        channel: "WHATSAPP",
        body: "unused",
        templateKey: "medical_certificate",
        variables: { patient: "Ravi", hospital: "City Clinic", doctor: "Dr Sharma", when: "8 Sep 2026" },
      },
      false,
    );
    expect(missingCertPdf).toEqual({ error: "Medical certificate PDF media id is missing." });

    const missingInvestigationPdf = templateComponents(
      {
        toPhone: "9876543210",
        channel: "WHATSAPP",
        body: "unused",
        templateKey: "investigation_list",
        variables: { patient: "Ravi", hospital: "City Clinic", items: "CBC, Chest X-ray" },
      },
      false,
    );
    expect(missingInvestigationPdf).toEqual({ error: "Investigation list PDF media id is missing." });

    const investigation = templateComponents(
      {
        toPhone: "9876543210",
        channel: "WHATSAPP",
        body: "unused",
        templateKey: "investigation_list",
        variables: { patient: "Ravi", hospital: "City Clinic", items: "CBC, Chest X-ray" },
        documentMediaId: "media-inv",
        documentFilename: "investigation-list-MRN1.pdf",
      },
      false,
    );
    expect(investigation).toEqual([
      {
        type: "header",
        parameters: [{ type: "document", document: { link: "media-inv", filename: "investigation-list-MRN1.pdf" } }],
      },
      {
        type: "body",
        parameters: [
          { type: "text", parameter_name: "patient_name", text: "Ravi" },
          { type: "text", parameter_name: "hospital_name", text: "City Clinic" },
          { type: "text", parameter_name: "test_list", text: "CBC, Chest X-ray" },
        ],
      },
    ]);
  });

  it("builds utility access-number template without OTP wording", () => {
    expect(
      templateComponents({ toPhone: "9876543210", channel: "WHATSAPP", body: "unused", templateKey: "otp" }),
    ).toEqual({ error: "OTP value missing for WhatsApp send." });

    const otp = templateComponents({
      toPhone: "9876543210",
      channel: "WHATSAPP",
      body: "unused",
      templateKey: "otp",
      otp: "123456",
    });
    expect(otp).toEqual([
      {
        type: "body",
        parameters: [
          { type: "text", parameter_name: "patientname", text: "Code" },
          { type: "text", parameter_name: "birthyear", text: "123456" },
        ],
      },
    ]);
  });

  it("builds utility bill receipt with document header and named body vars", () => {
    expect(
      templateComponents(
        {
          toPhone: "9876543210",
          channel: "WHATSAPP",
          body: "unused",
          templateKey: "bill_receipt",
          variables: { patient: "Ravi", invoiceNo: "INV-1", hospital: "City Clinic", total: "₹500" },
        },
        false,
      ),
    ).toEqual({ error: "Bill receipt PDF media id is missing." });

    const bill = templateComponents(
      {
        toPhone: "9876543210",
        channel: "WHATSAPP",
        body: "unused",
        templateKey: "bill_receipt",
        variables: { patient: "Ravi", invoiceNo: "INV-1", hospital: "City Clinic", total: "₹500" },
        documentMediaId: "media-123",
        documentFilename: "bill-INV-1.pdf",
      },
      false,
    );
    expect(bill).toEqual([
      {
        type: "header",
        parameters: [{ type: "document", document: { link: "media-123", filename: "bill-INV-1.pdf" } }],
      },
      {
        type: "body",
        parameters: [
          { type: "text", parameter_name: "patient_name", text: "Ravi" },
          { type: "text", parameter_name: "invoice_no", text: "INV-1" },
          { type: "text", parameter_name: "hospital_name", text: "City Clinic" },
          { type: "text", parameter_name: "total_amount", text: "₹500" },
        ],
      },
    ]);
  });
});
