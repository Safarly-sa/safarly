/* ── localStorage mirror of the real auth session ──────────────────────
   The real session is a server-issued httpOnly cookie (Express + Drizzle,
   see artifacts/api-server/src/routes/auth.ts); auth-api.ts is the actual
   client. This file only mirrors { name, email } into localStorage so the
   Navbar and profile-complete checks can read synchronously — never treat
   it as authoritative for anything session-guarded.
   Keys:
     safarly_auth             { name: string; email: string }
     safarly_profile_complete "true" | absent
──────────────────────────────────────────────────────────────────────── */

import { logOutRemote } from "./auth-api";

export interface SafarlyAuth {
  name: string;
  email: string;
}

export function getAuth(): SafarlyAuth | null {
  try {
    return JSON.parse(localStorage.getItem("safarly_auth") ?? "null");
  } catch {
    return null;
  }
}

export function setAuth(auth: SafarlyAuth): void {
  localStorage.setItem("safarly_auth", JSON.stringify(auth));
  window.dispatchEvent(new Event("safarly-auth-changed"));
}

export function isProfileComplete(): boolean {
  return localStorage.getItem("safarly_profile_complete") === "true";
}

export function markProfileComplete(): void {
  localStorage.setItem("safarly_profile_complete", "true");
}

/**
 * Destination for the "Start Planning" CTA — always the planner, signed in or
 * not.
 *
 * This used to bounce anonymous visitors to /login before they saw anything.
 * The wall now sits at the *results* instead (components/ResultsGate.tsx):
 * planning is free and runs entirely client-side, so there is nothing to
 * protect until the billable enrichment agents get involved. Asking someone to
 * register before they have seen a single itinerary was costing us the people
 * most worth converting.
 */
export function getStartPath(): string {
  return "/planner";
}

/**
 * Validates a `returnTo` value taken from a URL query string before it is
 * handed to `navigate()`. Only same-app, path-only targets are honored —
 * anything absolute ("https://evil.com/x") or protocol-relative ("//evil.com")
 * is rejected, since an attacker-controlled login link could otherwise send a
 * signed-in user's session onward to another origin.
 */
export function sanitizeReturnTo(path: string | null | undefined): string | null {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return null;
  return path;
}

/* ── Sign out ────────────────────────────────────────────────────────── */

/**
 * Sign-out clears identity only — trips, profile, learned phrases and saved
 * dishes stay on the device, so signing back in (now a real account via the
 * API, not just typing a name) picks up exactly where the user left off.
 */
export function signOut(): void {
  // Fire-and-forget: destroy the server session too, so the httpOnly cookie
  // cannot be replayed. Deliberately not awaited — local sign-out must succeed
  // even when the API is unreachable, and the caller is a click handler.
  void logOutRemote();

  localStorage.removeItem("safarly_auth");
  window.dispatchEvent(new Event("safarly-auth-changed"));
}
