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

/** Printable name: "dhanush" → "Dhanush". */
export function titleCasePersonName(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => {
      const lower = part.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

/**
 * Remove internal role tags (adm, doc, nur, …) and uniqueness digits from a login handle
 * so display names stay human — e.g. dhanush.adm → dhanush, priyasharma.doc.2 → priyasharma.
 * Older handles without the dot (dhanushadm) still strip.
 */
export function stripUsernameRoleSuffix(handle: string) {
  const trimmed = handle.trim();
  if (!trimmed) return "";
  const withoutDigits = trimmed.replace(/(?:[.\s]+)?\d+$/, "");
  const core = (withoutDigits || trimmed).replace(/[.\s]+$/, "");
  const lower = core.toLowerCase();
  for (const suffix of USERNAME_ROLE_SUFFIXES) {
    for (const marker of [`.${suffix}`, ` ${suffix}`]) {
      if (lower.endsWith(marker) && core.length > marker.length) {
        return core.slice(0, -marker.length);
      }
    }
    if (lower.endsWith(suffix) && core.length > suffix.length + 1) {
      return core.slice(0, -suffix.length);
    }
  }
  return core;
}

/** Login username from first name, last name, and role — e.g. ravikumar.doc, nurse.nur. */
export function suggestedUsername(firstName: string, lastName: string, role?: string | null) {
  const suffix = (role && USERNAME_ROLE_SUFFIX[role]) || "doc";
  const raw = [letters(firstName), letters(lastName)].filter(Boolean).join("") || "staff";
  const name = raw.slice(0, Math.max(1, 48 - suffix.length - 1));
  return `${name}.${suffix}`;
}

/** Name printed under a signature, e.g. Dr. Ravi Kumar. */
export function suggestedSignatureName(firstName: string, lastName: string, role?: string | null) {
  let full = `${firstName} ${lastName}`.replace(/\s+/g, " ").trim();
  if (!full) return "";
  // Single-token names seeded from login handles still carry adm/doc — strip before print.
  if (!lastName.trim() && !firstName.includes(" ")) {
    full = stripUsernameRoleSuffix(firstName) || full;
  }
  const titled = titleCasePersonName(full.replace(/^dr\.?\s+/i, ""));
  if (!titled) return "";
  if (role === "DOCTOR") return `Dr. ${titled}`;
  return titled;
}
