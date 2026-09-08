const USERNAME_ROLE_SUFFIX: Record<string, string> = {
  DOCTOR: "doc",
  NURSE: "nur",
  RECEPTIONIST: "rec",
  PHARMACIST: "phr",
  LAB_TECH: "lab",
  ACCOUNTANT: "acc",
  SUPER_ADMIN: "adm",
};

function letters(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Login username from first name, last name, and role — e.g. ravikumardoc. */
export function suggestedUsername(firstName: string, lastName: string, role?: string | null) {
  const name = [letters(firstName), letters(lastName)].filter(Boolean).join("") || "staff";
  const suffix = (role && USERNAME_ROLE_SUFFIX[role]) || "doc";
  return `${name}${suffix}`.slice(0, 48);
}

/** Name printed under a signature, e.g. Dr. Ravi Kumar. */
export function suggestedSignatureName(firstName: string, lastName: string, role?: string | null) {
  const full = `${firstName} ${lastName}`.replace(/\s+/g, " ").trim();
  if (!full) return "";
  if (role === "DOCTOR") {
    return /^dr\.?\s/i.test(full) ? full : `Dr. ${full}`;
  }
  return full;
}
