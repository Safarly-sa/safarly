/* ── Form validation helpers ──────────────────────────────────────────── */

/**
 * Password policy.
 *
 * Mirrored by the API server, which re-checks every rule on submit — this copy
 * exists only to give live feedback as the user types. Never treat a
 * client-side pass as authorisation; the server is the authority. Keep the two
 * in sync (artifacts/api-server/src/routes/auth.ts).
 *
 * Follows NIST SP 800-63B in weighting length and a blocklist of predictable
 * choices over character-class gymnastics, while still requiring enough
 * variety to rule out "aaaaaaaaaaaa".
 */
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

/**
 * Passwords that pass the mechanical rules but are guessed immediately.
 * Compared case-insensitively with digits/symbols stripped, so "P@ssw0rd1"
 * is caught by the "password" entry.
 */
const COMMON_PASSWORDS = [
  "password", "passwd", "welcome", "letmein", "qwerty", "azerty", "iloveyou",
  "admin", "administrator", "root", "login", "monkey", "dragon", "sunshine",
  "princess", "football", "baseball", "superman", "trustno", "starwars",
  "abcdef", "abcdefg", "asdfgh", "zxcvbn", "qwertyuiop",
  "safarly", "saudi", "riyadh", "jeddah",
];

export interface PasswordRule {
  id: string;
  label: string;
  passed: boolean;
}

export interface PasswordAssessment {
  rules: PasswordRule[];
  /** Every rule satisfied — the only thing that should enable submit. */
  valid: boolean;
  /** 0-4, for the meter only. Never gates submission. */
  score: number;
  /** First unmet requirement, ready to show as an error. */
  firstFailure: string | null;
}

/**
 * Leetspeak substitutions are folded back to letters *before* stripping, or
 * the blocklist is trivially bypassed: "P@ssw0rd" would otherwise reduce to
 * "psswrd" and sail past the "password" entry.
 */
const LEET: Record<string, string> = {
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s",
  "7": "t", "8": "b", "9": "g", "@": "a", "$": "s", "!": "i", "+": "t",
};

function isCommon(password: string): boolean {
  const normalised = password
    .toLowerCase()
    .replace(/[01345789@$!+]/g, (c) => LEET[c] ?? c)
    .replace(/[^a-z]/g, "");

  if (normalised.length === 0) return false;
  return COMMON_PASSWORDS.some((c) => normalised.includes(c));
}

/** Rejects "aaaaaaaaaa", "abcdefghij", "1234567890". */
function hasNoTrivialSequence(password: string): boolean {
  const lower = password.toLowerCase();
  if (/(.)\1{3,}/.test(lower)) return false;

  const runLimit = 4;
  let ascending = 1;
  let descending = 1;
  for (let i = 1; i < lower.length; i++) {
    const delta = lower.charCodeAt(i) - lower.charCodeAt(i - 1);
    ascending = delta === 1 ? ascending + 1 : 1;
    descending = delta === -1 ? descending + 1 : 1;
    if (ascending >= runLimit || descending >= runLimit) return false;
  }
  return true;
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
      label: `At least ${PASSWORD_MIN_LENGTH} characters`,
      passed: password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH,
    },
    {
      id: "lower",
      label: "One lowercase letter",
      passed: /[a-z]/.test(password),
    },
    {
      id: "upper",
      label: "One uppercase letter",
      passed: /[A-Z]/.test(password),
    },
    {
      id: "number",
      label: "One number",
      passed: /[0-9]/.test(password),
    },
    {
      id: "notCommon",
      label: "Not a commonly used password",
      passed: password.length > 0 && !isCommon(password) && hasNoTrivialSequence(password),
    },
    {
      id: "notPersonal",
      label: "Doesn't contain your name or email",
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
    firstFailure: rules.find((r) => !r.passed)?.label ?? null,
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
