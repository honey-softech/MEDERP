import { describe, expect, it } from "vitest";
import {
  parseHospitalWhatsAppLanguage,
  parsePatientWhatsAppLanguage,
  patientWhatsAppLanguageLabel,
  resolveWhatsAppLanguage,
  resolveWhatsAppTemplateName,
} from "@/lib/messaging/whatsapp-language";

describe("WhatsApp message language", () => {
  it("uses the patient language, then the hospital default, then English", () => {
    expect(resolveWhatsAppLanguage("ta", "hi")).toBe("ta");
    expect(resolveWhatsAppLanguage(null, "kn")).toBe("kn");
    expect(resolveWhatsAppLanguage("", "Malayalam")).toBe("ml");
    expect(resolveWhatsAppLanguage(null, null)).toBe("en");
    expect(resolveWhatsAppLanguage("French", "nope")).toBe("en");
  });

  it("accepts an empty patient choice and rejects an unknown one", () => {
    expect(parsePatientWhatsAppLanguage("")).toEqual({ ok: true, value: null });
    expect(parsePatientWhatsAppLanguage("Hindi")).toEqual({ ok: true, value: "hi" });
    expect(parsePatientWhatsAppLanguage("spanish")).toEqual({
      ok: false,
      error: "Select a valid WhatsApp language.",
    });
    expect(parseHospitalWhatsAppLanguage("")).toEqual({ ok: false, error: "Select a WhatsApp language." });
    expect(parseHospitalWhatsAppLanguage("ta")).toEqual({ ok: true, value: "ta" });
  });

  it("picks the language-specific template name and keeps English names", () => {
    expect(resolveWhatsAppTemplateName("visit_summary", "en", "visit_summary_")).toBe("visit_summary_");
    expect(resolveWhatsAppTemplateName("visit_summary", "hi", "visit_summary_")).toBe("visit_summary_hi");
    expect(resolveWhatsAppTemplateName("bill_receipt", "ta", "billpreceipt")).toBe("billpreceipt_ta");
    expect(resolveWhatsAppTemplateName("appointment_reminder", "kn", "appointment_reminder1")).toBe(
      "appointment_reminder_kn",
    );
    expect(resolveWhatsAppTemplateName("investigation_list", "ml", "investigation_list")).toBe(
      "investigation_list_ml",
    );
    expect(resolveWhatsAppTemplateName("medical_certificate", "hi", "medical_certificate")).toBe(
      "medical_certificate_hi",
    );
    expect(resolveWhatsAppTemplateName("otp", "ta", "reminder")).toBe("reminder");
    expect(resolveWhatsAppTemplateName("subscription_bill", "hi", "subscription_bill")).toBe("subscription_bill");
  });

  it("describes a patient who follows the hospital language", () => {
    expect(patientWhatsAppLanguageLabel(null, "ta")).toBe("Same as hospital (Tamil)");
    expect(patientWhatsAppLanguageLabel("hi", "en")).toBe("Hindi");
  });
});
