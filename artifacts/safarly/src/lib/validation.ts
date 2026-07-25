/* ── Form validation helpers ──────────────────────────────────────────── */

/**
 * Password policy.
 *
 * Mirrored by the API server, which re-checks every rule on submit — this copy
 * exists only to give live feedback as the user types. Never treat a
 * client-side pass as authorisation; the server is the authority. Keep the two
 * in sync (artifacts/api-server/src/routes/auth.ts).
 *
 * Length and character variety only — no common-password blocklist or
 * trivial-sequence check, by design.
 *
 * Display strings live in the locales under `password.rule.*` /
 * `password.strength.*`, not here — this module stays locale-agnostic so
 * callers can translate. Adding a rule needs a matching key in all 11 locale
 * files (see artifacts/safarly/src/locales/locales.test.ts).
 */
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

export type PasswordRuleId = "length" | "lower" | "upper" | "number" | "notPersonal";

export interface PasswordRule {
  id: PasswordRuleId;
  passed: boolean;
}

export interface PasswordAssessment {
  rules: PasswordRule[];
  /** Every rule satisfied — the only thing that should enable submit. */
  valid: boolean;
  /** 0-4, for the meter only. Never gates submission. */
  score: number;
  /** Id of the first unmet requirement, for the caller to translate. */
  firstFailureId: PasswordRuleId | null;
}

/**
 * Evaluates a password against the policy.
 *
 * `identifiers` are the user's own email and name — a password containing them
 * is trivially guessable by anyone who knows the account.
 */
export function assessPassword(password: string, identifiers: string[] = []): PasswordAssessment {
  const containsIdentifier = identifiers
    .map((value) => value.trim().toLowerCase())
    .flatMap((value) => [value, value.split("@")[0]])
    .filter((value) => value.length >= 3)
    .some((value) => password.toLowerCase().includes(value));

  const rules: PasswordRule[] = [
    {
      id: "length",
      passed: password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH,
    },
    {
      id: "lower",
      passed: /[a-z]/.test(password),
    },
    {
      id: "upper",
      passed: /[A-Z]/.test(password),
    },
    {
      id: "number",
      passed: /[0-9]/.test(password),
    },
    {
      id: "notPersonal",
      passed: password.length > 0 && !containsIdentifier,
    },
  ];

  const valid = rules.every((r) => r.passed);

  // Meter: reward length beyond the minimum and symbol use, both optional.
  let score = 0;
  if (password.length >= PASSWORD_MIN_LENGTH) score++;
  if (password.length >= 14) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (valid) score++;

  return {
    rules,
    valid,
    score: Math.min(score, 4),
    firstFailureId: rules.find((r) => !r.passed)?.id ?? null,
  };
}

/**
 * Pragmatic email check.
 *
 * Deliberately not RFC 5322 — that grammar allows quoted strings, comments and
 * IP-literal domains that no travel signup form wants, and the "full" regexes
 * for it are unreadable and still wrong at the edges. This covers the shapes
 * real users type, and rejects the mistakes they actually make: missing @,
 * missing TLD, spaces, double dots, a trailing dot.
 *
 * The only authoritative check that an address exists is sending mail to it.
 */
export function isValidEmail(value: string): boolean {
  const email = value.trim();

  if (email.length === 0 || email.length > 254) return false;
  if (/\s/.test(email)) return false;
  if (email.includes("..")) return false;

  const at = email.lastIndexOf("@");
  if (at < 1 || at === email.length - 1) return false;

  const local = email.slice(0, at);
  const domain = email.slice(at + 1);

  if (local.length > 64) return false;
  if (local.startsWith(".") || local.endsWith(".")) return false;
  if (domain.startsWith("-") || domain.startsWith(".") || domain.endsWith(".")) return false;

  // Domain must be label(.label)+ with a 2+ char alphabetic TLD.
  if (!/^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)*$/.test(domain)) {
    return false;
  }
  if (!/\.[A-Za-z]{2,}$/.test(domain)) return false;

  // Local part: common printable set, no leading/trailing dot (checked above).
  return /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+$/.test(local);
}
