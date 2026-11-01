export type MarketingFeature = {
  slug: "opd" | "billing" | "whatsapp";
  title: string;
  keyword: string;
  summary: string;
  paragraphs: string[];
};

export const marketingModules = [
  {
    title: "OPD queue and front desk",
    body: "Clinic OPD software for patient registration, appointments, walk-ins, and a token queue that starts at the first visit of the day.",
  },
  {
    title: "Nurse station and vitals",
    body: "A nurse worklist records height, weight, temperature, and other vitals before the doctor opens the consult.",
  },
  {
    title: "Doctor consult",
    body: "Assessment, diagnosis, prescription, and a printable visit summary stay on the same patient chart.",
  },
  {
    title: "Clinic billing",
    body: "Clinic billing software for the consultation fee, receipts, advances, and the day's collections.",
  },
  {
    title: "WhatsApp",
    body: "Send the visit summary, bill, and reminder on WhatsApp before the patient leaves the clinic.",
  },
  {
    title: "Staff and seats",
    body: "Doctors, nurses, and reception share one hospital, with plans sized by users and active patients.",
  },
] as const;

export const marketingFeatures: MarketingFeature[] = [
  {
    slug: "opd",
    title: "OPD management software for clinics in India",
    keyword: "OPD management software",
    summary:
      "MedERP is OPD management software for the front desk: register the patient, book the appointment, add a walk-in, and issue a token that follows the day's schedule.",
    paragraphs: [
      "Scheduled visits take the earlier tokens, in appointment order from the start of the day. When a doctor has a morning session and an evening session, the evening visit continues that sequence. It does not start again at T-001.",
      "A walk-in does not take a scheduled patient's token. Walk-ins are numbered after the scheduled visits, so the queue on the screen matches the order reception expects.",
      "Reception, the nurse, and the doctor open the same visit. Check-in, vitals, the consult, and the bill stay on that token instead of being retyped in another register.",
    ],
  },
  {
    slug: "billing",
    title: "Clinic billing software for the consultation fee",
    keyword: "clinic billing software",
    summary:
      "MedERP is clinic billing software for the OPD fee: record the payment, print the receipt, and see the day's collections without a separate accounts book.",
    paragraphs: [
      "A visit booked for today can take the consultation fee before or after check-in. A walk-in asks for the fee before vitals and the consult. A later date stays a booking until that day.",
      "Receipts, advances, and the collection list sit with the appointment, so the front desk does not hunt for a bill that belongs to another system.",
      "Plans are monthly, in rupees, with a one-month free trial. GST is added on the subscription. The consultation fee you collect from patients is separate from the MedERP plan.",
    ],
  },
  {
    slug: "whatsapp",
    title: "Clinic WhatsApp for visit summaries and bills",
    keyword: "clinic WhatsApp",
    summary:
      "MedERP sends the visit summary, the bill, and the reminder on WhatsApp from the visit the doctor just finished.",
    paragraphs: [
      "After the summary is approved, staff can send it to the mobile number on the patient record. The same visit can send the receipt.",
      "A follow-up date on the assessment can queue a reminder before the patient is due back, when the hospital turns reminders on.",
      "WhatsApp stays attached to the chart. Reception does not copy the prescription into a separate chat.",
    ],
  },
];

export function featureBySlug(slug: string) {
  return marketingFeatures.find((feature) => feature.slug === slug) ?? null;
}
