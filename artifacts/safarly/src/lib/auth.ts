/* ── Simple localStorage-backed auth helpers ──────────────────────────
   No passwords — this is a demo auth layer (localStorage only).
   Keys:
     safarly_auth             { name: string; email: string }
     safarly_profile_complete "true" | absent
──────────────────────────────────────────────────────────────────────── */

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
