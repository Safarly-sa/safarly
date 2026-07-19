/* ── Form validation helpers ──────────────────────────────────────────── */

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
