/**
 * Calls to the auth API.
 *
 * The session lives in an httpOnly cookie the server sets, so there is no token
 * to read or store here — that is the point. Every request needs
 * `credentials: "include"` or the browser will not send the cookie
 * cross-origin (Vite dev server and API run on different ports).
 *
 * Passwords are only ever passed through to the server. Never persist one.
 */

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

export interface ApiUser {
  id: string;
  email: string;
  name: string;
}

export type AuthResult =
  | { ok: true; user: ApiUser }
  | { ok: false; error: string };

const OFFLINE_MESSAGE =
  "Can't reach the Safarly server. Make sure the API is running, then try again.";

async function post(path: string, body: unknown): Promise<Response> {
  return fetch(`${API_BASE}/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
}

async function toResult(res: Response): Promise<AuthResult> {
  let payload: { user?: ApiUser; error?: string } = {};
  try {
    payload = await res.json();
  } catch {
    /* Non-JSON body (proxy error page, 502) — fall through to status text. */
  }

  if (!res.ok) {
    return { ok: false, error: payload.error ?? `Something went wrong (${res.status}).` };
  }
  if (!payload.user) {
    return { ok: false, error: "Unexpected response from the server." };
  }
  return { ok: true, user: payload.user };
}

export async function signUp(input: {
  name: string;
  email: string;
  password: string;
}): Promise<AuthResult> {
  try {
    return await toResult(await post("/auth/signup", input));
  } catch {
    return { ok: false, error: OFFLINE_MESSAGE };
  }
}

export async function logIn(input: {
  email: string;
  password: string;
}): Promise<AuthResult> {
  try {
    return await toResult(await post("/auth/login", input));
  } catch {
    return { ok: false, error: OFFLINE_MESSAGE };
  }
}

/** Best-effort — a failure here must not block the local sign-out. */
export async function logOutRemote(): Promise<void> {
  try {
    await post("/auth/logout", {});
  } catch {
    /* Offline: the local session is cleared regardless. */
  }
}

/** Current user per the session cookie, or null. */
export async function fetchMe(): Promise<ApiUser | null> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, { credentials: "include" });
    if (!res.ok) return null;
    const payload = await res.json();
    return payload.user ?? null;
  } catch {
    return null;
  }
}
