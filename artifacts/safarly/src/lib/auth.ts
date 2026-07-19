/* ── Simple localStorage-backed auth helpers ──────────────────────────
   No passwords — this is a demo auth layer (localStorage only).
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

/** Destination for the "Start Planning" CTA. */
export function getStartPath(): string {
  return getAuth() && isProfileComplete() ? "/trip" : "/login";
}

/* ── Sign out ────────────────────────────────────────────────────────── */

/**
 * Every account-scoped key. Device preferences (`safarly-lang`,
 * `safarly-theme`) are deliberately absent — they describe the device, not the
 * person, and should survive a sign-out.
 *
 * Sign-in is passwordless: anyone can become "signed in" by typing a name. If
 * sign-out left this data behind, the next person to sign in on a shared device
 * would inherit the previous user's trips, dietary restrictions, and allergies.
 * So sign-out clears all of it.
 *
 * Add new account-scoped keys here, or they will leak across sign-outs.
 */
const ACCOUNT_KEYS = [
  "safarly_auth",
  "safarly_profile",
  "safarly_profile_complete",
  "safarly_trip",
  "safarly_itinerary",
  "safarly_ongoing_trip",
  "safarly_past_trips",
  "safarly_learned",
  "safarly_favorites",
] as const;

/**
 * Clears all account-scoped data and notifies listeners. There is no server
 * copy of any of this, so it cannot be undone — callers should confirm first.
 */
export function signOut(): void {
  // Fire-and-forget: destroy the server session too, so the httpOnly cookie
  // cannot be replayed. Deliberately not awaited — local sign-out must succeed
  // even when the API is unreachable, and the caller is a click handler.
  void logOutRemote();

  for (const key of ACCOUNT_KEYS) localStorage.removeItem(key);
  window.dispatchEvent(new Event("safarly-auth-changed"));
}
