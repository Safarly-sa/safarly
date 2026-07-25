/**
 * Calls to the trip-enrichment agents (Events, Transportation, Accommodation).
 *
 * Mirrors the conventions in vision-api.ts: same API_BASE, same
 * `credentials: "include"` (the route is session-guarded), same "never show raw
 * server text" discipline — error codes are mapped to localized strings by the
 * caller, not passed through as-is.
 *
 * This does NOT generate the itinerary. engine.ts already builds the day-by-day
 * stops from a curated POI dataset — offline, free, and unable to invent places
 * that don't exist. This layers on top of that result the three things a fixed
 * dataset genuinely can't know: real-world events, transport reasoning, and
 * where to stay. Enrichment is therefore always ADDITIVE and never blocking:
 * every failure path returns a code and leaves the caller's itinerary untouched,
 * so a down API or an offline traveller still gets their full trip.
 *
 * Transport uses SSE rather than a plain JSON response because the three agents
 * run concurrently server-side and finish in whatever order they finish — the
 * generating screen shows real per-agent completion, not a scripted sequence.
 */

import type {
  AccommodationOption,
  ArrivalTransport,
  ItineraryResult,
  TransportLeg,
  TripEvent,
} from "./engine";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

/* ── Wire types ─────────────────────────────────────────────────────── */

/**
 * Per-day transport as the server sends it. engine.ts stores these on the day
 * itself (ItineraryDay.transportLegs), so this shape only exists in transit —
 * applyEnrichment() folds it into the days.
 */
export interface DayTransport {
  dayNumber: number;
  legs: TransportLeg[];
}

/**
 * One stop as sent to the server. The coordinates are the point: with them the
 * Transportation agent computes each hop's real distance instead of guessing
 * from a place name. Optional so a stop without them still works — it just
 * falls back to the model path server-side.
 */
export interface TripEnrichStop {
  name: string;
  lat?: number;
  lng?: number;
}

/** POST /api/trip/generate request body. Mirrors the server's TripGenerateRequest. */
export interface TripEnrichRequest {
  cityDisplayName: string;
  cityDisplayNameAr?: string;
  dateStart: string;
  dateEnd: string;
  budgetSarPerDay: number;
  travelType: string;
  languageName: string;
  days: { dayNumber: number; stops: TripEnrichStop[] }[];
  poiAreas: string[];
}

export interface TripEnrichment {
  events: TripEvent[];
  arrival: ArrivalTransport;
  dayTransport: DayTransport[];
  accommodation: AccommodationOption[];
}

export type TripStageName = "planning" | "events" | "transport" | "accommodation";
export type TripStageStatus = "start" | "done" | "error";

export interface TripStageEvent {
  stage: TripStageName;
  status: TripStageStatus;
}

export type TripErrorCode =
  | "not-signed-in"
  | "rate-limited"
  | "not-configured"
  | "bad-request"
  | "offline"
  | "unknown";

export type TripEnrichResult =
  | { ok: true; data: TripEnrichment }
  | { ok: false; code: TripErrorCode };

function codeFromStatus(status: number): TripErrorCode {
  if (status === 401) return "not-signed-in";
  if (status === 429) return "rate-limited";
  if (status === 503) return "not-configured";
  if (status === 400) return "bad-request";
  return "unknown";
}

/* ── SSE frame parsing ──────────────────────────────────────────────── */

/**
 * Reads an SSE body and invokes `onFrame` per complete `event:`/`data:` frame.
 *
 * EventSource can't be used here — it only issues GETs, and this endpoint needs
 * a POST body. So the framing is parsed by hand off fetch's ReadableStream.
 * Frames are separated by a blank line; JSON.stringify escapes newlines inside
 * strings, so a raw "\n\n" can only ever be a frame boundary, never payload.
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
 * Runs the enrichment trio, reporting each agent's real completion via
 * `onStage` as it happens.
 *
 * Never throws: a dead server, an aborted request, or a malformed stream all
 * resolve to `{ ok: false, code }`. The caller is expected to carry on with the
 * unenriched itinerary rather than surface a hard failure — enrichment is a
 * bonus layer, not a prerequisite for having a trip.
 */
export async function enrichTrip(
  request: TripEnrichRequest,
  options: {
    onStage?: (event: TripStageEvent) => void;
    signal?: AbortSignal;
  } = {},
): Promise<TripEnrichResult> {
  const { onStage, signal } = options;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/trip/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(request),
      signal,
    });
  } catch {
    // Network failure, DNS, CORS, or an abort — all indistinguishable here and
    // all handled the same way by the caller: keep the local itinerary.
    return { ok: false, code: "offline" };
  }

  if (!res.ok) return { ok: false, code: codeFromStatus(res.status) };
  if (!res.body) return { ok: false, code: "unknown" };

  let result: TripEnrichment | null = null;

  try {
    await readSseStream(res.body, (eventName, data) => {
      let payload: unknown;
      try {
        payload = JSON.parse(data);
      } catch {
        return; // A malformed frame shouldn't abort the ones that follow it.
      }

      if (eventName === "stage") {
        onStage?.(payload as TripStageEvent);
      } else if (eventName === "result") {
        result = payload as TripEnrichment;
      }
    });
  } catch {
    // Stream died mid-flight. If the result frame already landed, that partial
    // success is still worth keeping; otherwise report it.
    if (!result) return { ok: false, code: "offline" };
  }

  if (!result) return { ok: false, code: "unknown" };
  return { ok: true, data: result };
}

/**
 * Folds an enrichment payload onto an itinerary, returning a new result.
 *
 * Pure and non-mutating — the caller keeps its original object, which matters
 * because the unenriched itinerary is the fallback that gets persisted if
 * anything about this step goes wrong.
 */
export function applyEnrichment(
  itinerary: ItineraryResult,
  enrichment: TripEnrichment,
): ItineraryResult {
  const legsByDay = new Map<number, TransportLeg[]>();
  for (const day of enrichment.dayTransport ?? []) {
    legsByDay.set(day.dayNumber, day.legs);
  }

  return {
    ...itinerary,
    events: enrichment.events,
    arrival: enrichment.arrival,
    accommodation: enrichment.accommodation,
    days: itinerary.days.map((day) => {
      const legs = legsByDay.get(day.dayNumber);
      return legs ? { ...day, transportLegs: legs } : day;
    }),
  };
}

/**
 * Builds the request body from what the client already has.
 *
 * Stops are sent with their lat/lng, not just their names. That's what lets the
 * Transportation agent compute each hop's real distance rather than guess it
 * from a place name — the coordinates were already in the POI dataset all
 * along, previously used only to drop Leaflet markers.
 *
 * `poiAreas` feeds the Accommodation agent's "their itinerary centres on X"
 * framing. POIs carry no area field, so the real neighbourhood names come from
 * meal venues; POI names are appended as location anchors when there aren't
 * enough of those to be useful on their own.
 */
export function buildEnrichRequest(params: {
  itinerary: ItineraryResult;
  dateStart: string;
  dateEnd: string;
  budgetSarPerDay: number;
  travelType: string;
  languageName: string;
  cityDisplayNameAr?: string;
}): TripEnrichRequest {
  const { itinerary } = params;

  const areas: string[] = [];
  const seen = new Set<string>();
  const push = (value: string | undefined) => {
    const trimmed = value?.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    areas.push(trimmed);
  };

  for (const day of itinerary.days) {
    for (const meal of day.meals) push(meal.area);
  }
  for (const day of itinerary.days) {
    for (const stop of day.stops) push(stop.poi.name);
  }

  return {
    cityDisplayName: itinerary.cityName,
    cityDisplayNameAr: params.cityDisplayNameAr,
    dateStart: params.dateStart,
    dateEnd: params.dateEnd,
    budgetSarPerDay: params.budgetSarPerDay,
    travelType: params.travelType,
    languageName: params.languageName,
    days: itinerary.days.map((day) => ({
      dayNumber: day.dayNumber,
      stops: day.stops.map((stop) => ({
        name: stop.poi.name,
        lat:  stop.poi.lat,
        lng:  stop.poi.lng,
      })),
    })),
    poiAreas: areas.slice(0, 12),
  };
}
