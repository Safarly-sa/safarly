/**
 * Calls to the Live Lens vision agent.
 *
 * Mirrors the conventions in auth-api.ts: same API_BASE, same
 * `credentials: "include"` (the agent route requires a session cookie), same
 * "never show raw server text" discipline — error codes are mapped to
 * localized strings by the caller, not passed through as-is.
 */

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

export type VisionMode = "menu" | "place" | "sign";

export interface VisionDish {
  nameOriginal: string;
  nameTranslated: string;
  description: string;
  ingredients: string[];
  allergenTokens: string[];
  uncertain: boolean;
  priceText?: string;
}

export interface VisionPlace {
  name: string;
  nameTranslated: string;
  category: string;
  culturalContext: string;
  visitorTip?: string;
  uncertain: boolean;
}

export interface VisionSignLine {
  original: string;
  translated: string;
}

export interface VisionSign {
  lines: VisionSignLine[];
  meaning: string;
  uncertain: boolean;
}

export type VisionErrorCode =
  | "not-signed-in"
  | "rate-limited"
  | "not-configured"
  | "bad-image"
  | "offline"
  | "unknown";

export type VisionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: VisionErrorCode; retryAfterSeconds?: number };

function codeFromStatus(status: number): VisionErrorCode {
  if (status === 401) return "not-signed-in";
  if (status === 429) return "rate-limited";
  if (status === 503) return "not-configured";
  if (status === 400 || status === 413) return "bad-image";
  return "unknown";
}

async function callVision<T>(mode: VisionMode, params: {
  base64: string;
  mimeType: string;
  languageName: string;
}): Promise<VisionResult<T>> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/agents/vision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        mode,
        imageBase64: params.base64,
        mimeType: params.mimeType,
        languageName: params.languageName,
      }),
    });
  } catch {
    return { ok: false, code: "offline" };
  }

  if (!res.ok) {
    let retryAfterSeconds: number | undefined;
    try {
      const payload = await res.json();
      if (typeof payload.retryAfterSeconds === "number") retryAfterSeconds = payload.retryAfterSeconds;
    } catch {
      /* body may be empty or non-JSON */
    }
    return { ok: false, code: codeFromStatus(res.status), retryAfterSeconds };
  }

  try {
    const payload = await res.json();
    return { ok: true, data: payload.result as T };
  } catch {
    return { ok: false, code: "unknown" };
  }
}

export function scanMenuImage(base64: string, mimeType: string, languageName: string) {
  return callVision<{ dishes: VisionDish[] }>("menu", { base64, mimeType, languageName });
}

export function scanPlaceImage(base64: string, mimeType: string, languageName: string) {
  return callVision<VisionPlace>("place", { base64, mimeType, languageName });
}

export function scanSignImage(base64: string, mimeType: string, languageName: string) {
  return callVision<VisionSign>("sign", { base64, mimeType, languageName });
}
