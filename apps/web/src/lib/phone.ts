export function normalizeMobile(mobile: string) {
  let digits = String(mobile ?? "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return digits;
}

/** Indian mobile: 10 digits starting 6–9. Used for login and hospital registration. */
export function isValidIndianMobile(mobile: string) {
  return /^[6-9]\d{9}$/.test(normalizeMobile(mobile));
}

export function mobileValidationError(mobile: string, label = "Mobile number") {
  const digits = normalizeMobile(mobile);
  if (!digits) return `Enter the ${label.toLowerCase()}.`;
  if (digits.length !== 10) return `${label} must be a 10-digit Indian mobile number.`;
  if (!isValidIndianMobile(digits)) return `${label} must start with 6, 7, 8, or 9.`;
  return null;
}
