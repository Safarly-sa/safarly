/**
 * Calls to the Dialect & Language Coach.
 *
 * Mirrors the types in artifacts/api-server/src/routes/dialect/dialect-types.ts.
 * Kept in sync by cross-reference comment, not by import — same convention as
 * trip-api.ts and concierge-api.ts.
 *
 * Plain JSON rather than SSE: both calls are a single short round-trip whose
 * result is only useful complete.
 *
 * This never decides whether an attempt passed. dialect.tsx's arabicMatch()
 * does that instantly, offline and for free, and keeps doing it — this only
 * adds the coaching sentence a word-overlap check can't write. So every failure
 * path here is silent: the learner keeps their verdict and simply doesn't get a
 * tip, which is exactly the behaviour before this existed.
 */

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

export type Dialect = "najdi" | "hijazi" | "janubi" | "shamali" | "sharqi";

export interface DialectEvaluateRequest {
  dialect: Dialect;
  targetArabic: string;
  targetTransliteration: string;
  targetEnglish: string;
  /** Already transcribed client-side via the Web Speech API, or typed — no audio leaves the device. */
  userAttempt: string;
  languageName: string;
}

export interface DialectEvaluateResult {
  passed: boolean;
  feedback: string;
  correctedArabic?: string;
  correctedTransliteration?: string;
}

export interface DialectLine {
  speaker: "local" | "traveller";
  arabic: string;
  transliteration: string;
  translation: string;
}

export interface DialectDialogueRequest {
  dialect: Dialect;
  situation: string;
  languageName: string;
}

export interface DialectDialogueResult {
  lines: DialectLine[];
}

export type DialectErrorCode =
  | "not-signed-in"
  | "rate-limited"
  | "not-configured"
  | "bad-request"
  | "offline"
  | "unknown";

export type DialectResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: DialectErrorCode };

function codeFromStatus(status: number): DialectErrorCode {
  if (status === 401) return "not-signed-in";
  if (status === 429) return "rate-limited";
  if (status === 503) return "not-configured";
  if (status === 400) return "bad-request";
  return "unknown";
}

async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<DialectResult<T>> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/dialect/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
      signal,
    });
  } catch {
    return { ok: false, code: "offline" };
  }

  if (!res.ok) return { ok: false, code: codeFromStatus(res.status) };

  try {
    const payload = await res.json();
    return { ok: true, data: payload.result as T };
  } catch {
    return { ok: false, code: "unknown" };
  }
}

/** Coaching text for one practice attempt. Additive — never the pass/fail verdict. */
export function evaluateAttempt(
  request: DialectEvaluateRequest,
  signal?: AbortSignal,
): Promise<DialectResult<DialectEvaluateResult>> {
  return post<DialectEvaluateResult>("evaluate", request, signal);
}

/** A short situational dialogue in the chosen regional dialect. */
export function fetchDialogue(
  request: DialectDialogueRequest,
  signal?: AbortSignal,
): Promise<DialectResult<DialectDialogueResult>> {
  return post<DialectDialogueResult>("dialogue", request, signal);
}
