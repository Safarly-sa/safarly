/**
 * Maps the API's English error prose to a locale key.
 *
 * String-matching is brittle, but this pass is frontend-scoped — a server
 * message drifting from this list degrades to showing the server's raw
 * English string rather than breaking the error path. See
 * docs/notes/auth-ux-implementation-plan.md Phase 5 for the proper fix
 * (a server-side error code instead of prose matching).
 */
const KNOWN_MESSAGES: Record<string, string> = {
  "Incorrect email or password.": "auth.error.invalid_credentials",
  "An account with that email already exists.": "auth.error.email_taken",
  "Too many attempts. Please try again in 15 minutes.": "auth.error.rate_limited",
  "This reset link is invalid or has expired.": "auth.error.reset_invalid",
  "No account found with that email address.": "auth.error.not_found",
  "Can't reach the Safarly server. Make sure the API is running, then try again.": "auth.error.offline",
};

/** Falls back to `auth.error.unknown` for anything unrecognized, rather than
    showing a blank error. */
export function authErrorKey(serverMessage: string): string {
  return KNOWN_MESSAGES[serverMessage] ?? "auth.error.unknown";
}
