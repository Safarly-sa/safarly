/**
 * Calls to the Personal Concierge — the app's only conversational surface.
 *
 * Mirrors the types in artifacts/api-server/src/routes/concierge/concierge-types.ts.
 * Kept in sync by cross-reference comment, not by import (the two packages don't
 * share a types package for this domain) — change one side, change the other.
 *
 * The endpoint is stateless: there is no server-side trip storage, so the client
 * sends its chat history AND its current itinerary state on every turn, and
 * applies the returned patch to its own copy. That means the itinerary in
 * localStorage stays the single source of truth, and a dropped connection can
 * never leave the server holding a version of the trip the traveller can't see.
 *
 * Transport is SSE for the same reason as trip-api.ts, plus one more: replies
 * arrive incrementally, so the UI can render text as it lands instead of
 * blocking on a complete answer.
 */

import {
  recalcTotals,
  scheduleStop,
  type ItineraryResult,
  type ItineraryStop,
  type POI,
} from "./engine";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

/* ── Wire types ─────────────────────────────────────────────────────── */

/** A POI trimmed to what the model needs to reason with — not the full dataset row. */
export interface ConciergePoi {
  id: string;
  name: string;
  category: string;
  durationHrs: number;
  hiddenGem: boolean;
}

export interface ConciergeDay {
  dayNumber: number;
  stops: ConciergePoi[];
}

export interface ConciergeChatTurn {
  role: "user" | "model";
  text: string;
}

export interface ConciergeChatRequest {
  message: string;
  history: ConciergeChatTurn[];
  languageName: string;
  cityDisplayName: string;
  dateStart: string;
  dateEnd: string;
  days: ConciergeDay[];
  candidatePois: ConciergePoi[];
}

export type ConciergeAction =
  | { type: "remove_stop"; dayNumber: number; poiId: string }
  | { type: "add_stop"; dayNumber: number; poiId: string; slot: ItineraryStop["slot"] }
  | { type: "swap_stop"; dayNumber: number; removePoiId: string; addPoiId: string; slot: ItineraryStop["slot"] }
  | { type: "reorder_day"; dayNumber: number; stopOrder: string[] };

export interface ConciergePatch {
  actions: ConciergeAction[];
  summary: string;
}

export type ConciergeErrorCode =
  | "not-signed-in"
  | "rate-limited"
  | "not-configured"
  | "bad-request"
  | "offline"
  | "unknown";

/** Streamed callbacks. `onToken` fires many times; the rest at most once each. */
export interface ConciergeHandlers {
  onToken?: (text: string) => void;
  onToolCall?: (name: string) => void;
  onPatch?: (patch: ConciergePatch) => void;
  signal?: AbortSignal;
}

export type ConciergeResult =
  | { ok: true; text: string; patch: ConciergePatch | null }
  | { ok: false; code: ConciergeErrorCode };

function codeFromStatus(status: number): ConciergeErrorCode {
  if (status === 401) return "not-signed-in";
  if (status === 429) return "rate-limited";
  if (status === 503) return "not-configured";
  if (status === 400) return "bad-request";
  return "unknown";
}

/* ── SSE frame parsing ──────────────────────────────────────────────── */

/**
 * Identical framing to trip-api.ts's reader. Duplicated rather than shared
 * because the two are the only consumers and a premature "sse-client" module
 * would abstract over exactly two call sites; revisit if a third appears.
 */
async function readSseStream(
  body: ReadableStream<Uint8Array>,
  onFrame: (event: string, data: string) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      let eventName = "message";
      let data = "";
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) eventName = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (data) onFrame(eventName, data);

      boundary = buffer.indexOf("\n\n");
    }
  }
}

/* ── Public API ─────────────────────────────────────────────────────── */

/**
 * Sends one conversational turn and streams the reply.
 *
 * Never throws. An aborted request (the traveller navigated away or sent a new
 * message) resolves as `offline` like any other transport failure — the caller
 * checks its own abort state to tell the two apart, because a cancelled turn
 * should not surface an error to someone who simply moved on.
 */
export async function sendConciergeMessage(
  request: ConciergeChatRequest,
  handlers: ConciergeHandlers = {},
): Promise<ConciergeResult> {
  const { onToken, onToolCall, onPatch, signal } = handlers;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/concierge/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(request),
      signal,
    });
  } catch {
    return { ok: false, code: "offline" };
  }

  if (!res.ok) return { ok: false, code: codeFromStatus(res.status) };
  if (!res.body) return { ok: false, code: "unknown" };

  let text = "";
  let patch: ConciergePatch | null = null;
  let serverError = false;

  try {
    await readSseStream(res.body, (eventName, data) => {
      let payload: unknown;
      try {
        payload = JSON.parse(data);
      } catch {
        return; // One malformed frame shouldn't discard the rest of the reply.
      }

      switch (eventName) {
        case "token": {
          const chunk = (payload as { text?: string }).text ?? "";
          text += chunk;
          onToken?.(chunk);
          break;
        }
        case "tool_call":
          onToolCall?.((payload as { name?: string }).name ?? "");
          break;
        case "patch":
          patch = payload as ConciergePatch;
          onPatch?.(patch);
          break;
        case "error":
          serverError = true;
          break;
      }
    });
  } catch {
    // Stream cut mid-reply. Partial text is still worth showing; only report a
    // failure when nothing at all arrived.
    if (!text) return { ok: false, code: "offline" };
  }

  if (serverError && !text) return { ok: false, code: "unknown" };
  return { ok: true, text, patch };
}

/* ── Request building ───────────────────────────────────────────────── */

function toConciergePoi(poi: POI): ConciergePoi {
  return {
    id: poi.id,
    name: poi.name,
    category: poi.category,
    durationHrs: poi.duration_hrs,
    hiddenGem: poi.hidden_gem,
  };
}

/**
 * Builds the trip-state half of a chat request.
 *
 * `candidatePois` is the closed set of things the model is allowed to add —
 * POIs in this city that aren't already scheduled. The server re-validates
 * every id against this list, so an incomplete list here can only ever cause a
 * suggestion to be dropped, never an invented place to be inserted.
 */
export function buildConciergeState(
  itinerary: ItineraryResult,
  allCityPois: POI[],
): Pick<ConciergeChatRequest, "days" | "candidatePois" | "cityDisplayName"> {
  const scheduled = new Set(
    itinerary.days.flatMap((day) => day.stops.map((stop) => stop.poi.id)),
  );

  return {
    cityDisplayName: itinerary.cityName,
    days: itinerary.days.map((day) => ({
      dayNumber: day.dayNumber,
      stops: day.stops.map((stop) => toConciergePoi(stop.poi)),
    })),
    candidatePois: allCityPois
      .filter((poi) => !scheduled.has(poi.id))
      .slice(0, 100)
      .map(toConciergePoi),
  };
}

/* ── Patch application ──────────────────────────────────────────────── */

/**
 * Applies a validated patch to an itinerary, returning a new result.
 *
 * Pure and non-mutating: the caller keeps the pre-patch itinerary, which is
 * what makes undo possible and what gets persisted if anything here rejects an
 * action. Actions are applied in order and independently — one that references
 * a POI this client can't resolve is skipped rather than aborting the rest,
 * matching how the server validates them.
 *
 * Costs and budget flags are re-derived through the engine afterwards, so a
 * Concierge edit and a generated day always agree on what a day costs.
 */
export function applyConciergePatch(
  itinerary: ItineraryResult,
  patch: ConciergePatch,
  poisById: Map<string, POI>,
  budgetPerDay: number,
): { result: ItineraryResult; appliedCount: number } {
  let days = itinerary.days;
  let appliedCount = 0;

  const editDay = (dayNumber: number, edit: (stops: ItineraryStop[]) => ItineraryStop[] | null) => {
    let changed = false;
    const next = days.map((day) => {
      if (day.dayNumber !== dayNumber) return day;
      const stops = edit(day.stops);
      if (!stops) return day;
      changed = true;
      return { ...day, stops };
    });
    if (changed) {
      days = next;
      appliedCount++;
    }
  };

  /** Keeps a day readable after an edit: chronological, like the generator leaves it. */
  const byTime = (stops: ItineraryStop[]) =>
    [...stops].sort((a, b) => a.startTime.localeCompare(b.startTime));

  for (const action of patch.actions) {
    switch (action.type) {
      case "remove_stop":
        editDay(action.dayNumber, (stops) => {
          const next = stops.filter((s) => s.poi.id !== action.poiId);
          return next.length === stops.length ? null : next;
        });
        break;

      case "add_stop":
        editDay(action.dayNumber, (stops) => {
          const poi = poisById.get(action.poiId);
          if (!poi || stops.some((s) => s.poi.id === action.poiId)) return null;
          return byTime([...stops, scheduleStop(poi, action.slot)]);
        });
        break;

      case "swap_stop":
        editDay(action.dayNumber, (stops) => {
          const poi = poisById.get(action.addPoiId);
          if (!poi) return null;
          const without = stops.filter((s) => s.poi.id !== action.removePoiId);
          if (without.length === stops.length) return null; // nothing removed
          return byTime([...without, scheduleStop(poi, action.slot)]);
        });
        break;

      case "reorder_day":
        editDay(action.dayNumber, (stops) => {
          const byId = new Map(stops.map((s) => [s.poi.id, s]));
          const ordered = action.stopOrder
            .map((id) => byId.get(id))
            .filter((s): s is ItineraryStop => s !== undefined);
          if (ordered.length !== stops.length) return null;

          // Reordering means "visit these in this sequence", so the slot clock
          // is reassigned positionally — keeping each POI's original times
          // would produce a list whose order contradicts its own timestamps.
          const slots = stops.map((s) => s.slot);
          return ordered.map((stop, i) => scheduleStop(stop.poi, slots[i]));
        });
        break;
    }
  }

  if (appliedCount === 0) return { result: itinerary, appliedCount: 0 };
  return { result: recalcTotals({ ...itinerary, days }, budgetPerDay), appliedCount };
}
