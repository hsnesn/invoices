/**
 * Strong password requirements for the application.
 * Align with Supabase Auth settings: Auth → Providers → Email → Password requirements
 */
export const PASSWORD = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireDigit: true,
  requireSymbol: true,
  allowedSymbols: `!@#$%^&*()_+-=[]{};':"|<>?,./\`~`,
};

export type PasswordCheck = {
  ok: boolean;
  message: string;
};

export function validatePassword(password: string): PasswordCheck {
  if (password.length < PASSWORD.minLength) {
    return {
      ok: false,
      message: `Password must be at least ${PASSWORD.minLength} characters.`,
    };
  }
  if (PASSWORD.requireUppercase && !/[A-Z]/.test(password)) {
    return { ok: false, message: "Password must contain at least one uppercase letter." };
  }
  if (PASSWORD.requireLowercase && !/[a-z]/.test(password)) {
    return { ok: false, message: "Password must contain at least one lowercase letter." };
  }
  if (PASSWORD.requireDigit && !/\d/.test(password)) {
    return { ok: false, message: "Password must contain at least one number." };
  }
  if (PASSWORD.requireSymbol) {
    if (!/[^a-zA-Z0-9]/.test(password)) {
      return {
        ok: false,
        message: `Password must contain at least one symbol (e.g. !@#$%^&*).`,
      };
    }
  }
  return { ok: true, message: "Strong password" };
}

export function getPasswordStrength(password: string): {
  score: number;
  label: string;
  color: string;
} {
  let score = 0;
  if (password.length >= PASSWORD.minLength) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;
  if (password.length >= 12) score += 1;

  if (score <= 2) return { score, label: "Weak", color: "text-red-400" };
  if (score <= 4) return { score, label: "Fair", color: "text-amber-400" };
  if (score <= 5) return { score, label: "Good", color: "text-emerald-400" };
  return { score, label: "Strong", color: "text-emerald-500" };
}
