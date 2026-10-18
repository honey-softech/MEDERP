const USERNAME_ROLE_SUFFIX: Record<string, string> = {
  DOCTOR: "doc",
  NURSE: "nur",
  RECEPTIONIST: "rec",
  PHARMACIST: "phr",
  LAB_TECH: "lab",
  ACCOUNTANT: "acc",
  SUPER_ADMIN: "adm",
  HELPDESK: "hdk",
};

/** Role tags appended to storage-only usernames — never show these on clinical documents. */
const USERNAME_ROLE_SUFFIXES = Object.values(USERNAME_ROLE_SUFFIX).sort((a, b) => b.length - a.length);

function letters(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Remove internal role tags (adm, doc, nur, …) and uniqueness digits from a login handle
 * so display names stay human — e.g. dhanushadm → dhanush, priyasharmadoc2 → priyasharma.
 */
export function stripUsernameRoleSuffix(handle: string) {
  const trimmed = handle.trim();
  if (!trimmed) return "";
  const withoutDigits = trimmed.replace(/\d+$/, "");
  const core = withoutDigits || trimmed;
  const lower = core.toLowerCase();
  for (const suffix of USERNAME_ROLE_SUFFIXES) {
    if (lower.endsWith(suffix) && core.length > suffix.length + 1) {
      return core.slice(0, -suffix.length);
    }
  }
  return core;
}

/** Login username from first name, last name, and role — e.g. ravikumardoc. */
export function suggestedUsername(firstName: string, lastName: string, role?: string | null) {
  const name = [letters(firstName), letters(lastName)].filter(Boolean).join("") || "staff";
  const suffix = (role && USERNAME_ROLE_SUFFIX[role]) || "doc";
  return `${name}${suffix}`.slice(0, 48);
}

/** Name printed under a signature, e.g. Dr. Ravi Kumar. */
export function suggestedSignatureName(firstName: string, lastName: string, role?: string | null) {
  let full = `${firstName} ${lastName}`.replace(/\s+/g, " ").trim();
  if (!full) return "";
  // Single-token names seeded from login handles still carry adm/doc — strip before print.
  if (!lastName.trim() && !firstName.includes(" ")) {
    full = stripUsernameRoleSuffix(firstName) || full;
  }
  if (role === "DOCTOR") {
    return /^dr\.?\s/i.test(full) ? full : `Dr. ${full}`;
  }
  return full;
}
