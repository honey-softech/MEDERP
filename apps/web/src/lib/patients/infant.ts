export function babyOfName(parentName: string) {
  const name = parentName.replace(/\s+/g, " ").trim();
  return name ? `Baby of ${name}` : "";
}

export function isUnnamedInfantName(firstName: string | null | undefined) {
  return /^baby of\b/i.test(String(firstName ?? "").trim());
}

export function parentNameFromPatient(patient: { firstName: string; lastName?: string | null }) {
  return `${patient.firstName} ${patient.lastName ?? ""}`.replace(/\s+/g, " ").trim();
}

export function startOfLocalDay(value = new Date()) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

export function dateInputValue(value = new Date()) {
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${value.getFullYear()}-${month}-${day}`;
}
