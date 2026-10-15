/** Specialties a doctor can pick at registration and on their profile. */
export const DOCTOR_SPECIALTIES = [
  "General Medicine",
  "Paediatrics",
  "Obstetrics and Gynaecology",
  "Orthopaedics",
  "Dermatology",
  "ENT",
  "Ophthalmology",
  "Cardiology",
  "Pulmonology",
  "Gastroenterology",
  "Neurology",
  "Psychiatry",
  "Urology",
  "Nephrology",
  "Endocrinology",
  "General Surgery",
  "Dental",
  "Ayurveda",
  "Homeopathy",
  "Physiotherapy",
  "Radiology",
  "Anaesthesiology",
  "Oncology",
  "Diabetology",
] as const;

const SPECIALTY_KEYS = new Set(DOCTOR_SPECIALTIES.map((item) => item.toLowerCase()));

/**
 * One line under the doctor signature. The specialty is already stored with the
 * signature, and the visit also has a department — only the specialty is printed.
 */
export function visitSignoffLine(credentials?: string | null, departmentName?: string | null) {
  const department = departmentName?.trim() ?? "";
  const raw = credentials?.trim() ?? "";
  if (!raw) return department || null;

  const pieces = raw
    .split(/[\n,]/)
    .map((part) => part.trim())
    .filter((part) => part && !/^reg\.?\s/i.test(part) && !/^lic\.?\s/i.test(part));

  const specialty = pieces.find((part) => SPECIALTY_KEYS.has(part.toLowerCase()));
  if (specialty) return specialty;

  const first = pieces.find((part) => part.toLowerCase() !== department.toLowerCase());
  return first || pieces[0] || department || null;
}
