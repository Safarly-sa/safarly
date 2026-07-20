/**
 * Mirrors the matching types in artifacts/safarly/src/lib/concierge-api.ts
 * (once that lands) — same convention as trip-types.ts / vision.ts's allergen
 * vocabulary: kept in sync by cross-reference comment, not by import.
 */

/** A POI already scheduled on a day, or available to add — trimmed to what the model needs to reason with, not the full dataset row. */
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

/** POST /api/concierge/chat request body. */
export interface ConciergeChatRequest {
  message: string;
  history: ConciergeChatTurn[];
  languageName: string;
  cityDisplayName: string;
  dateStart: string;
  dateEnd: string;
  days: ConciergeDay[];
  /** POIs in the same city, not currently on the itinerary — the only valid targets for an "add" action. */
  candidatePois: ConciergePoi[];
}

/**
 * The itinerary-mutation vocabulary. Deliberately narrow and closed rather
 * than "return the new itinerary as JSON" — every action references an
 * EXISTING poi id (from the day it's already on) or a CANDIDATE id (from the
 * list the client explicitly offered), never an invented one. The server
 * validates every id against those two lists before returning a patch; see
 * concierge-tools.ts. This is the same shape of guard as the vision agent's
 * allergy check: the model proposes, deterministic code enforces the part
 * that has to be reliable.
 */
export type ConciergeAction =
  | { type: "remove_stop"; dayNumber: number; poiId: string }
  | { type: "add_stop"; dayNumber: number; poiId: string; slot: "morning" | "midday" | "afternoon" | "evening" }
  | { type: "swap_stop"; dayNumber: number; removePoiId: string; addPoiId: string; slot: "morning" | "midday" | "afternoon" | "evening" }
  | { type: "reorder_day"; dayNumber: number; stopOrder: string[] };

export interface ConciergePatch {
  actions: ConciergeAction[];
  summary: string;
}
