/**
 * Split out from chat.ts for the same reason as trip-validate.ts: zero
 * dependency on Express/session/DB machinery, so it's importable and
 * unit-testable on its own.
 */
import type { ConciergeChatRequest, ConciergeChatTurn, ConciergeDay, ConciergePoi } from "./concierge-types";

const MAX_HISTORY_TURNS = 30;
const MAX_MESSAGE_LENGTH = 1000;

function validatePoi(p: unknown): ConciergePoi | null {
  const x = p as Partial<ConciergePoi> | null;
  if (!x || typeof x.id !== "string" || typeof x.name !== "string") return null;
  return {
    id: x.id,
    name: x.name.slice(0, 120),
    category: typeof x.category === "string" ? x.category : "",
    durationHrs: typeof x.durationHrs === "number" ? x.durationHrs : 0,
    hiddenGem: Boolean(x.hiddenGem),
  };
}

function validateDay(d: unknown): ConciergeDay | null {
  const x = d as { dayNumber?: unknown; stops?: unknown } | null;
  if (!x || typeof x.dayNumber !== "number" || !Array.isArray(x.stops)) return null;
  const stops = x.stops.map(validatePoi).filter((p): p is ConciergePoi => p !== null);
  return { dayNumber: x.dayNumber, stops };
}

function validateTurn(t: unknown): ConciergeChatTurn | null {
  const x = t as Partial<ConciergeChatTurn> | null;
  if (!x || (x.role !== "user" && x.role !== "model") || typeof x.text !== "string") return null;
  return { role: x.role, text: x.text.slice(0, MAX_MESSAGE_LENGTH) };
}

export function validateChatRequest(body: unknown): ConciergeChatRequest | null {
  const b = body as Partial<ConciergeChatRequest> | null;
  if (!b || typeof b !== "object") return null;
  if (typeof b.message !== "string" || !b.message.trim()) return null;
  if (typeof b.cityDisplayName !== "string" || !b.cityDisplayName.trim()) return null;
  if (typeof b.dateStart !== "string" || typeof b.dateEnd !== "string") return null;
  if (!Array.isArray(b.days) || !Array.isArray(b.candidatePois)) return null;

  const history = Array.isArray(b.history)
    ? b.history
        .slice(-MAX_HISTORY_TURNS)
        .map(validateTurn)
        .filter((t): t is ConciergeChatTurn => t !== null)
    : [];

  return {
    message: b.message.trim().slice(0, MAX_MESSAGE_LENGTH),
    history,
    languageName: typeof b.languageName === "string" && b.languageName.trim() ? b.languageName.trim().slice(0, 40) : "English",
    cityDisplayName: b.cityDisplayName.trim().slice(0, 80),
    dateStart: b.dateStart,
    dateEnd: b.dateEnd,
    days: b.days.slice(0, 30).map(validateDay).filter((d): d is ConciergeDay => d !== null),
    candidatePois: b.candidatePois.slice(0, 100).map(validatePoi).filter((p): p is ConciergePoi => p !== null),
  };
}
