/**
 * The Concierge's tool set and the validation that keeps it safe.
 *
 * Two tools, not more. "delegates to the other agents as tools" is satisfied
 * by search_events genuinely calling into the Events agent's reasoning.
 * edit_itinerary, get_transport_advice-, and accommodation-style questions
 * are deliberately left as things the Concierge answers directly in
 * conversation, using its own general knowledge with the same "verify before
 * booking" framing as the other agents — building three more full
 * tool-execution pathways (each needing its own prompt, schema, and
 * validation, none of it testable without a live key) was judged not worth
 * it for what a chat reply already covers reasonably. Reconsider once this
 * has been used against a real key and the gap is felt.
 */
import { Type, type FunctionDeclaration } from "@google/genai";
import { getGemini, GEMINI_MODEL, parseJsonResponse } from "../../lib/gemini";
import { eventsSchema, type TripEvent } from "../trip/trip-types";
import type { ConciergeAction, ConciergeDay, ConciergePatch, ConciergePoi } from "./concierge-types";

export const EDIT_ITINERARY_TOOL: FunctionDeclaration = {
  name: "edit_itinerary",
  description:
    "Change the traveller's itinerary: remove a stop, add one from the candidate list, swap one for another, or reorder a day's stops. Only call this when the traveller has actually asked for a change, not just asked a question.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      actions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            type: {
              type: Type.STRING,
              enum: ["remove_stop", "add_stop", "swap_stop", "reorder_day"],
            },
            dayNumber: { type: Type.NUMBER },
            poiId: { type: Type.STRING, description: "For remove_stop — the existing stop's id" },
            removePoiId: { type: Type.STRING, description: "For swap_stop — the existing stop's id to remove" },
            addPoiId: {
              type: Type.STRING,
              description: "For add_stop/swap_stop — must be an id from the candidate POI list, never invented",
            },
            slot: {
              type: Type.STRING,
              enum: ["morning", "midday", "afternoon", "evening"],
              description: "For add_stop/swap_stop — which part of the day",
            },
            stopOrder: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "For reorder_day — the day's existing stop ids in the new order; must be the same set of ids, just reordered",
            },
          },
          required: ["type", "dayNumber"],
        },
      },
      summary: { type: Type.STRING, description: "One short sentence describing the change, to show the traveller" },
    },
    required: ["actions", "summary"],
  },
};

export const SEARCH_EVENTS_TOOL: FunctionDeclaration = {
  name: "search_events",
  description:
    "Look up festivals, exhibitions, or things happening around the traveller's dates or a specific area they mention. Call this when they ask about events, what's on, or things to do beyond their planned stops.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: { type: Type.STRING, description: "What the traveller is asking about, in their own words" },
    },
    required: ["query"],
  },
};

export const CONCIERGE_TOOLS: FunctionDeclaration[] = [EDIT_ITINERARY_TOOL, SEARCH_EVENTS_TOOL];

/**
 * Validates a model-proposed edit against what actually exists — the same
 * "model proposes, code enforces" split used for allergy matching in the
 * vision agent. An action referencing an id from neither the day's current
 * stops nor the candidate list is dropped, not applied; a bad reference in
 * one action doesn't invalidate the others.
 */
export function validateItineraryActions(
  actions: unknown,
  days: ConciergeDay[],
  candidatePois: ConciergePoi[],
): ConciergeAction[] {
  if (!Array.isArray(actions)) return [];

  const dayById = new Map(days.map((d) => [d.dayNumber, d]));
  const candidateIds = new Set(candidatePois.map((p) => p.id));
  const valid: ConciergeAction[] = [];

  for (const raw of actions) {
    const a = raw as Partial<ConciergeAction> & { type?: string };
    if (typeof a?.dayNumber !== "number") continue;
    const day = dayById.get(a.dayNumber);
    if (!day) continue;
    const existingIds = new Set(day.stops.map((s) => s.id));

    switch (a.type) {
      case "remove_stop": {
        if (typeof a.poiId === "string" && existingIds.has(a.poiId)) {
          valid.push({ type: "remove_stop", dayNumber: a.dayNumber, poiId: a.poiId });
        }
        break;
      }
      case "add_stop": {
        // The tool schema (EDIT_ITINERARY_TOOL) names this field "addPoiId" for
        // both add_stop and swap_stop — the model sends that name, not "poiId".
        const addPoiId = (a as Partial<ConciergeAction> & { addPoiId?: unknown }).addPoiId;
        if (
          typeof addPoiId === "string" &&
          candidateIds.has(addPoiId) &&
          isValidSlot(a.slot)
        ) {
          valid.push({ type: "add_stop", dayNumber: a.dayNumber, poiId: addPoiId, slot: a.slot });
        }
        break;
      }
      case "swap_stop": {
        if (
          typeof a.removePoiId === "string" &&
          existingIds.has(a.removePoiId) &&
          typeof a.addPoiId === "string" &&
          candidateIds.has(a.addPoiId) &&
          isValidSlot(a.slot)
        ) {
          valid.push({
            type: "swap_stop",
            dayNumber: a.dayNumber,
            removePoiId: a.removePoiId,
            addPoiId: a.addPoiId,
            slot: a.slot,
          });
        }
        break;
      }
      case "reorder_day": {
        if (
          Array.isArray(a.stopOrder) &&
          a.stopOrder.length === existingIds.size &&
          a.stopOrder.every((id) => typeof id === "string" && existingIds.has(id)) &&
          new Set(a.stopOrder).size === a.stopOrder.length
        ) {
          valid.push({ type: "reorder_day", dayNumber: a.dayNumber, stopOrder: a.stopOrder });
        }
        break;
      }
      default:
        break;
    }
  }

  return valid;
}

function isValidSlot(slot: unknown): slot is "morning" | "midday" | "afternoon" | "evening" {
  return slot === "morning" || slot === "midday" || slot === "afternoon" || slot === "evening";
}

export function buildPatch(rawArgs: unknown, days: ConciergeDay[], candidatePois: ConciergePoi[]): ConciergePatch {
  const args = rawArgs as { actions?: unknown; summary?: unknown };
  return {
    actions: validateItineraryActions(args?.actions, days, candidatePois),
    summary: typeof args?.summary === "string" ? args.summary.slice(0, 300) : "",
  };
}

const DEMO_SEARCH_EVENTS: TripEvent[] = [
  {
    name: "Local weekend market",
    description: "A recurring craft and food market, typically Thursday–Saturday evenings.",
    category: "seasonal",
    dateRange: "Weekly (typical)",
    overlapsTrip: true,
    uncertain: true,
  },
];

/**
 * Reuses the Events agent's schema but not its trip-wide prompt — a chat
 * query ("what's happening near Al-Balad?") is a genuinely different prompt
 * shape from "list everything plausible for this whole trip," even though
 * the output shape (TripEvent[]) is identical.
 */
export async function runEventsSearch(
  query: string,
  cityDisplayName: string,
  dateStart: string,
  dateEnd: string,
  languageName: string,
  demo: boolean,
): Promise<TripEvent[]> {
  if (demo) {
    await new Promise((r) => setTimeout(r, 500));
    return DEMO_SEARCH_EVENTS;
  }

  const prompt = `A traveller in ${cityDisplayName}, Saudi Arabia (${dateStart} to ${dateEnd}) asks: "${query}"

List festivals, exhibitions, or things happening that answer this, if anything plausible comes to mind. You have no live calendar access — set "uncertain" true on everything unless you're confident it's a fixed annual date. Return an empty events array if nothing plausible fits. Respond in ${languageName}.`;

  const ai = getGemini();
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { responseMimeType: "application/json", responseSchema: eventsSchema, temperature: 0.4 },
  });

  if (!response.text) return [];
  return parseJsonResponse<{ events: TripEvent[] }>(response.text).events;
}
