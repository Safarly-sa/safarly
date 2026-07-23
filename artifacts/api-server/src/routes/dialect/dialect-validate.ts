/**
 * Split out from the route module for the same reason as trip-validate.ts and
 * chat-validate.ts: zero dependency on Express/session/DB machinery, so it is
 * importable and unit-testable on its own.
 */
import { DIALECTS, type Dialect, type DialectEvaluateRequest, type DialectDialogueRequest } from "./dialect-types";

const MAX_ATTEMPT = 300;
const MAX_SITUATION = 120;
const MAX_PHRASE = 300;

function asDialect(value: unknown): Dialect | null {
  return typeof value === "string" && (DIALECTS as readonly string[]).includes(value)
    ? (value as Dialect)
    : null;
}

function languageName(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 40) : "English";
}

export function validateEvaluateRequest(body: unknown): DialectEvaluateRequest | null {
  const b = body as Partial<DialectEvaluateRequest> | null;
  if (!b || typeof b !== "object") return null;

  const dialect = asDialect(b.dialect);
  if (!dialect) return null;
  if (typeof b.targetArabic !== "string" || !b.targetArabic.trim()) return null;
  // An empty attempt is a real case — the mic caught nothing — but there is
  // nothing to evaluate, so the caller should not have asked.
  if (typeof b.userAttempt !== "string" || !b.userAttempt.trim()) return null;

  return {
    dialect,
    targetArabic: b.targetArabic.trim().slice(0, MAX_PHRASE),
    targetTransliteration: typeof b.targetTransliteration === "string" ? b.targetTransliteration.slice(0, MAX_PHRASE) : "",
    targetEnglish: typeof b.targetEnglish === "string" ? b.targetEnglish.slice(0, MAX_PHRASE) : "",
    userAttempt: b.userAttempt.trim().slice(0, MAX_ATTEMPT),
    languageName: languageName(b.languageName),
  };
}

export function validateDialogueRequest(body: unknown): DialectDialogueRequest | null {
  const b = body as Partial<DialectDialogueRequest> | null;
  if (!b || typeof b !== "object") return null;

  const dialect = asDialect(b.dialect);
  if (!dialect) return null;
  if (typeof b.situation !== "string" || !b.situation.trim()) return null;

  return {
    dialect,
    situation: b.situation.trim().slice(0, MAX_SITUATION),
    languageName: languageName(b.languageName),
  };
}
