/**
 * Authoritative signup/login validation.
 *
 * The frontend has a mirror of these rules in
 * artifacts/safarly/src/lib/validation.ts, but that copy exists purely to give
 * the user live feedback. This one decides. Any request reaching these routes
 * may have skipped the UI entirely, so every rule is re-checked here — keep the
 * two files in sync when the policy changes.
 */

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;
export const EMAIL_MAX_LENGTH = 254;
export const NAME_MAX_LENGTH = 80;

export function isValidEmail(value: string): boolean {
  const email = value.trim();
  if (email.length === 0 || email.length > EMAIL_MAX_LENGTH) return false;
  if (/\s/.test(email)) return false;
  if (email.includes("..")) return false;

  const at = email.lastIndexOf("@");
  if (at < 1 || at === email.length - 1) return false;

  const local = email.slice(0, at);
  const domain = email.slice(at + 1);

  if (local.length > 64) return false;
  if (local.startsWith(".") || local.endsWith(".")) return false;
  if (domain.startsWith("-") || domain.startsWith(".") || domain.endsWith(".")) return false;
  if (!/^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)*$/.test(domain)) return false;
  if (!/\.[A-Za-z]{2,}$/.test(domain)) return false;
  return /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+$/.test(local);
}

/** Lowercased + trimmed. Always store and look up the normalised form. */
export function normaliseEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** Returns an error message, or null when the password is acceptable. */
export function validatePassword(password: string, identifiers: string[] = []): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  // Bounded to keep a huge body from tying up a memory-hard KDF.
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`;
  }
  if (!/[a-z]/.test(password)) return "Password must include a lowercase letter.";
  if (!/[A-Z]/.test(password)) return "Password must include an uppercase letter.";
  if (!/[0-9]/.test(password)) return "Password must include a number.";

  const contains = identifiers
    .map((v) => v.trim().toLowerCase())
    .flatMap((v) => [v, v.split("@")[0]])
    .filter((v) => v.length >= 3)
    .some((v) => password.toLowerCase().includes(v));
  if (contains) return "Password must not contain your name or email address.";

  return null;
}
