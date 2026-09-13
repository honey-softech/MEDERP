import { describe, expect, it } from "vitest";
import { buildInvestigationListPdf } from "@/lib/investigation-list-pdf";

describe("investigation list PDF", () => {
  it("builds a PDF with the requested tests", async () => {
    const pdf = await buildInvestigationListPdf({
      hospital: { name: "City Clinic", address: "MG Road", phone: "08012345678" },
      patient: {
        firstName: "Ravi",
        lastName: "Kumar",
        mrn: "MRN1",
        dateOfBirth: new Date("1990-01-15"),
        gender: "MALE",
        phone: "9876543210",
      },
      doctor: { firstName: "Anita", lastName: "Sharma" },
      departmentName: "General Medicine",
      scheduledAt: new Date("2026-09-12T05:00:00.000Z"),
      tokenNumber: 12,
      items: [
        { name: "CBC", category: "Haematology", outside: false },
        { name: "Chest X-ray", category: "Radiology", outside: true },
      ],
      requestedBy: "Dr. Anita Sharma",
    });

    expect(pdf.subarray(0, 4).toString("utf8")).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(400);
  });
});
