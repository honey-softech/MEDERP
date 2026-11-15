import { describe, expect, it } from "vitest";
import { buildVisitSummaryPdf, type VisitSummaryPdfInput } from "@/lib/visit-summary-pdf";

const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function input(assessment: VisitSummaryPdfInput["assessment"]): VisitSummaryPdfInput {
  return {
    hospital: { name: "City Clinic", address: "MG Road", phone: "08012345678", code: "CC" },
    patient: {
      firstName: "Ravi",
      lastName: "Kumar",
      mrn: "MRN1",
      dateOfBirth: new Date("1990-01-15"),
      gender: "MALE",
    },
    doctor: { firstName: "Anita", lastName: "Sharma" },
    departmentName: "General Medicine",
    visitType: "NEW",
    scheduledAt: new Date("2026-09-12T05:00:00.000Z"),
    tokenNumber: 4,
    vitalsRows: [{ label: "Pulse", value: "82 bpm" }],
    assessment,
  };
}

describe("visit summary PDF", () => {
  it("builds the typed summary", async () => {
    const pdf = await buildVisitSummaryPdf(
      input({
        diagnosis: "URTI",
        chiefComplaint: "Cough",
        entryMode: "TYPED",
      }),
    );
    expect(pdf.subarray(0, 4).toString("utf8")).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(400);
  });

  it("builds a handwritten summary with the ink page in the same template", async () => {
    const pdf = await buildVisitSummaryPdf(
      input({
        entryMode: "HANDWRITTEN",
        handwritingPages: JSON.stringify([TINY_PNG, TINY_PNG]),
        visitOutcome: "FOLLOW_UP",
        followUpAt: new Date("2026-09-19T00:00:00.000Z"),
      }),
    );
    expect(pdf.subarray(0, 4).toString("utf8")).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(400);
  });
});
