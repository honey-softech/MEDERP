import PDFDocument from "pdfkit";
import { formatClinicDate } from "@/lib/clinic-time";
import { doctorName, printableDoctorLabel, prettyEnum } from "@/lib/front-desk";
import { visitSignoffLine } from "@/lib/doctor-specialties";
import { pngSize, readHandwritingPages } from "@/lib/handwriting";
import { trimInkDataUrl } from "@/lib/trim-ink";
import {
  drawClinicalRow,
  drawIdentity,
  drawLetterhead,
  drawPrintFooter,
  drawSignoff,
  drawTitle,
  drawTwoColTable,
  imageFromDataUrl,
  pageWidth,
  printClock,
} from "@/lib/print-document-pdf";
import {
  ageGenderLine,
  encounterNumber,
  parseMedications,
  readableClinicalText,
  visitDateLabel,
} from "@/lib/visit-summary";

export type VisitSummaryPdfInput = {
  hospital: {
    name: string;
    address?: string | null;
    phone?: string | null;
    code: string;
    logoData?: string | null;
    sealData?: string | null;
  };
  patient: {
    firstName: string;
    lastName: string;
    mrn: string;
    dateOfBirth: Date;
    gender: string;
  };
  doctor: {
    firstName: string;
    lastName: string;
    appUser?: { username: string } | null;
  };
  departmentName: string;
  visitType: string;
  scheduledAt: Date;
  tokenNumber?: number | null;
  vitalsRows?: { label: string; value: string }[];
  printedAt?: string;
  assessment: {
    diagnosis?: string | null;
    chiefComplaint?: string | null;
    summary?: string | null;
    examination?: string | null;
    advice?: string | null;
    prescription?: string | null;
    visitOutcome?: string | null;
    followUpAt?: Date | null;
    approvedByDisplayName?: string | null;
    approvedByCredentials?: string | null;
    approvedBySignatureImage?: string | null;
    approvedBySignature?: { imageData?: string | null } | null;
    entryMode?: string | null;
    handwritingPages?: string[] | string | null;
  };
};

export async function buildVisitSummaryPdf(input: VisitSummaryPdfInput): Promise<Buffer> {
  const patientName = `${input.patient.firstName} ${input.patient.lastName}`.trim();
  const medicines = parseMedications(readableClinicalText(input.assessment.prescription));
  const followUp = input.assessment.followUpAt ? formatClinicDate(input.assessment.followUpAt) : null;
  const outcome =
    input.assessment.visitOutcome === "DISCHARGE"
      ? "Discharged"
      : followUp
        ? `Follow-up on ${followUp}`
        : input.assessment.visitOutcome === "FOLLOW_UP"
          ? "Follow up"
          : "—";
  const physician = doctorName(input.doctor);
  const printedAt = input.printedAt ?? printClock();
  const handwritten = input.assessment.entryMode === "HANDWRITTEN";
  const inkPages = handwritten ? readHandwritingPages(input.assessment.handwritingPages) : [];

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4", bufferPages: inkPages.length > 1 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    drawLetterhead(doc, input.hospital);
    drawTitle(doc, "Visit summary");
    drawIdentity(doc, {
      patientName,
      ageGender: ageGenderLine(input.patient.dateOfBirth, input.patient.gender),
      ids: [
        { label: "Encounter no.", value: encounterNumber(input.hospital.code, input.scheduledAt, input.tokenNumber) },
        { label: "UHID", value: input.patient.mrn },
      ],
      meta: [
        { label: "Appointment type", value: prettyEnum(input.visitType) },
        { label: "Date", value: visitDateLabel(input.scheduledAt) },
        { label: "Consulting physician", value: physician },
        { label: "Department", value: input.departmentName },
      ],
      vitals:
        input.vitalsRows && input.vitalsRows.length > 0
          ? input.vitalsRows
          : [
              "Temperature",
              "Height",
              "Weight",
              "BMI",
              "BSA",
              "SpO2",
              "Pulse",
              "Respiratory rate",
              "BP",
              "Blood sugar",
              "Fever",
              "Vital remarks",
            ].map((label) => ({ label, value: "—" })),
    });

    if (handwritten) {
      inkPages.forEach((page, index) => {
        if (index > 0) {
          doc.addPage();
          drawLetterhead(doc, input.hospital);
          doc
            .font("Helvetica")
            .fontSize(9)
            .fillColor("#616161")
            .text(`${patientName} · UHID ${input.patient.mrn} · ${visitDateLabel(input.scheduledAt)}`, {
              align: "center",
            });
          doc.moveDown(0.35);
        }
        drawInkPage(doc, page);
      });
    } else {
      drawClinicalRow(doc, "Diagnosis", `Final Diagnosis: ${readableClinicalText(input.assessment.diagnosis) || "—"}`);
      drawClinicalRow(doc, "Presenting complaints", readableClinicalText(input.assessment.chiefComplaint) || "—");
      drawClinicalRow(doc, "History of present illness", readableClinicalText(input.assessment.summary) || "—");
      drawClinicalRow(doc, "Systemic examination", readableClinicalText(input.assessment.examination) || "—");
      drawClinicalRow(doc, "Advice", readableClinicalText(input.assessment.advice) || "—");
    }
    drawClinicalRow(doc, followUp ? "Follow-up" : "Outcome", outcome);

    if (!handwritten) {
      drawTwoColTable(
        doc,
        ["Drug name", "Notes"],
        medicines.map((med) => ({ left: med.name, right: med.notes || "—" })),
      );
    }

    drawSignoff(doc, {
      name: printableDoctorLabel(input.assessment.approvedByDisplayName) || physician,
      credentials: visitSignoffLine(input.assessment.approvedByCredentials, input.departmentName),
      imageData: input.assessment.approvedBySignatureImage ?? input.assessment.approvedBySignature?.imageData,
    });

    if (inkPages.length > 1) {
      const range = doc.bufferedPageRange();
      for (let index = 0; index < range.count; index += 1) {
        doc.switchToPage(range.start + index);
        drawPrintFooter(doc, {
          printedAt,
          confidential: true,
          pageLabel: `Page ${index + 1}/${range.count}`,
        });
      }
    } else {
      drawPrintFooter(doc, { printedAt, confidential: true });
    }
    doc.end();
  });
}

function drawInkPage(doc: PDFKit.PDFDocument, dataUrl: string) {
  const image = imageFromDataUrl(trimInkDataUrl(dataUrl));
  if (!image) return;
  const size = pngSize(image.data);
  if (!size) return;
  const left = doc.page.margins.left;
  const width = pageWidth(doc);
  const bottom = doc.page.height - doc.page.margins.bottom - 150;
  const available = Math.max(120, bottom - doc.y);
  const scale = Math.min(width / size.width, available / size.height);
  const drawW = size.width * scale;
  const drawH = size.height * scale;
  try {
    doc.image(image.data, left + (width - drawW) / 2, doc.y, { width: drawW, height: drawH });
  } catch {
    return;
  }
  doc.y += drawH + 8;
  doc.x = left;
}
