export const MIN_PASSWORD_LENGTH = 8;

const BLOCKED_PASSWORD = /^password$/i;

export function passwordValidationError(password: string) {
  if (BLOCKED_PASSWORD.test(password.trim())) {
    return 'Password cannot be "password".';
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (!/[a-z]/.test(password)) {
    return "Password must include a lowercase letter.";
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must include an uppercase letter.";
  }
  if (!/[0-9]/.test(password)) {
    return "Password must include a number.";
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return "Password must include a symbol.";
  }
  return null;
}

/** Sign-in only blocks the literal password "password". Existing stronger passwords still work. */
export function signInPasswordError(password: string) {
  if (BLOCKED_PASSWORD.test(password.trim())) {
    return 'Password cannot be "password".';
  }
  return null;
}

export type PasswordStrengthLevel = "empty" | "weak" | "fair" | "good" | "strong";

export function passwordStrength(password: string): { level: PasswordStrengthLevel; label: string; score: number } {
  if (!password) return { level: "empty", label: "", score: 0 };
  let score = 0;
  if (password.length >= MIN_PASSWORD_LENGTH) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  if (BLOCKED_PASSWORD.test(password.trim()) || /password/i.test(password)) score = 1;
  if (score <= 2) return { level: "weak", label: "Weak", score: 1 };
  if (score === 3) return { level: "fair", label: "Fair", score: 2 };
  if (score === 4) return { level: "good", label: "Good", score: 3 };
  return { level: "strong", label: "Strong", score: 4 };
}

export function superAdminNameError(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "Super admin name is required.";
  if (/[.!,]/.test(trimmed)) return "Super admin name cannot include . ! or ,";
  return null;
}

export function stripSuperAdminName(value: string) {
  return value.replace(/[.!,]/g, "");
}
