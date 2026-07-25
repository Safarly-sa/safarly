/**
 * Transportation Agent — one arrival recommendation for the whole trip, plus
 * intracity legs for each day.
 *
 * The day legs are COMPUTED, not asked for. Stops arrive with real
 * coordinates, so transport-estimate.ts derives distance, mode, duration, and
 * a baseline fare arithmetically; the model is then given those legs and asked
 * only for the practical note it's actually better at than arithmetic ("no
 * shade on this stretch", "the entrance is on the far side"). That refinement
 * is strictly optional — if the call fails, is quota-blocked, or there's no
 * API key at all, the computed legs stand on their own. See transport-estimate.ts
 * for why fares stay flagged uncertain even though distances are exact.
 *
 * The old ask-the-model-for-everything path is kept as modelDayTransport() for
 * stops without coordinates (a day routed through a meal venue, say). It is a
 * real fallback, not dead code — but it produces the weaker output, so it runs
 * only when there is nothing to compute from.
 *
 * Arrival is still entirely model-driven: the dataset has POI coordinates but
 * no airport ones, so there is nothing to compute an airport→city leg from.
 * Adding a city→airport table is the natural follow-up to this change.
 *
 * Both calls run concurrently via Promise.all, so the refinement costs no extra
 * wall-clock time against the arrival call — and in the computed path it
 * replaces the old day-transport call rather than adding to it, leaving the
 * agent's free-tier quota cost unchanged at two requests.
 */
import { getGemini, GEMINI_MODEL, parseJsonResponse } from "../../lib/gemini";
import {
  arrivalSchema,
  dayTransportSchema,
  legNotesSchema,
  type ArrivalTransport,
  type DayTransport,
  type TransportLeg,
  type TripGenerateRequest,
  type AgentOutcome,
} from "./trip-types";
import {
  estimateDayTransport,
  isHotMonth,
  monthFromIsoDate,
  type EstimatedDay,
} from "./transport-estimate";
import { logger } from "../../lib/logger";

function arrivalPrompt(req: TripGenerateRequest): string {
  return `A traveller is arriving in ${req.cityDisplayName}, Saudi Arabia for a ${req.dateStart} to ${req.dateEnd} trip. Recommend how they most realistically get INTO the city (flight to the nearest airport, or intercity train/SAPTCO bus if that's genuinely the norm for this route) and then to their likely accommodation area. Give realistic SAR cost ranges and durations for Saudi Arabia — err toward typical/average figures, and set "uncertain" true on any leg where the specific cost or duration is a rough estimate rather than something you're confident about. Respond in ${req.languageName}.`;
}

/** Fallback prompt — only used when stops arrive without coordinates. */
function modelDayTransportPrompt(req: TripGenerateRequest): string {
  const days = req.days
    .map((d) => `Day ${d.dayNumber}: ${d.stops.map((s) => s.name).join(" → ")}`)
    .join("\n");
  return `A traveller in ${req.cityDisplayName}, Saudi Arabia is visiting these places in this order, one line per day:

${days}

For each day, suggest how to get between consecutive stops — walking if they're genuinely close, otherwise taxi/ride-hail (the norm for getting around Saudi cities), giving a realistic SAR cost and duration estimate for each hop. You do not know the exact distance between two specific named places, so set "uncertain" true on every leg — this is general guidance, not a live route calculation. Respond in ${req.languageName}.`;
}

/**
 * Asks only for notes on legs that are already settled. The distances are
 * stated as facts in the prompt precisely so the model reasons from them
 * rather than around them.
 */
function legNotesPrompt(req: TripGenerateRequest, estimated: EstimatedDay[], hot: boolean): string {
  const legLines = estimated
    .filter((d) => d.legs.length > 0)
    .map((d) => {
      const legs = d.legs
        .map((leg, i) => `  [${i}] ${leg.from} → ${leg.to} — ${leg.distanceKm} km, ${leg.mode}, ~${leg.durationMinutes} min`)
        .join("\n");
      return `Day ${d.dayNumber}:\n${legs}`;
    })
    .join("\n");

  const season = hot
    ? `The trip is in the hot season, so heat, shade, and time of day matter more than usual.`
    : `The trip is outside the hottest months.`;

  return `A traveller in ${req.cityDisplayName}, Saudi Arabia is making these journeys between stops. The distances, modes, and durations below are already calculated from real coordinates — treat them as correct and do not restate or contradict them.

${legLines}

${season}

For each leg, give ONE short practical note a traveller would be glad to know — shade and heat on a walk, parking or drop-off quirks, a pedestrian route that isn't obvious, an entrance on the far side of a site. If a leg has nothing genuinely useful to say about it, return an empty string for its note rather than padding. Do not mention prices. Respond in ${req.languageName}.`;
}

const DEMO_ARRIVAL: ArrivalTransport = {
  legs: [
    {
      from: "Airport",
      to: "City centre",
      mode: "taxi",
      durationMinutes: 35,
      costSar: 55,
      notes: "Ride-hail apps are widely available and often cheaper than airport taxi ranks.",
      uncertain: true,
      basis: "model",
    },
  ],
  summary: "Fly into the city's main airport, then taxi or ride-hail to your accommodation area.",
};

function toDayTransport(estimated: EstimatedDay[]): DayTransport[] {
  return estimated.map((d) => ({ dayNumber: d.dayNumber, legs: d.legs }));
}

/** Folds model notes onto computed legs by (dayNumber, legIndex). Never replaces a computed number. */
function applyLegNotes(days: DayTransport[], raw: unknown): DayTransport[] {
  const parsed = raw as { notes?: { dayNumber?: unknown; legIndex?: unknown; note?: unknown }[] };
  if (!Array.isArray(parsed?.notes)) return days;

  const byDay = new Map<number, Map<number, string>>();
  for (const entry of parsed.notes) {
    if (typeof entry?.dayNumber !== "number" || typeof entry?.legIndex !== "number") continue;
    if (typeof entry.note !== "string" || !entry.note.trim()) continue;
    if (!byDay.has(entry.dayNumber)) byDay.set(entry.dayNumber, new Map());
    byDay.get(entry.dayNumber)!.set(entry.legIndex, entry.note.trim().slice(0, 300));
  }

  return days.map((day) => {
    const notes = byDay.get(day.dayNumber);
    if (!notes) return day;
    return {
      ...day,
      legs: day.legs.map((leg, i) => {
        const note = notes.get(i);
        return note ? { ...leg, notes: note } : leg;
      }),
    };
  });
}

const DEMO_LEG_NOTE = "Ride-hail pickup is straightforward here; allow a few extra minutes at peak times.";

/** Gives demo mode the same computed legs the live path produces, with a canned note. */
function demoNotes(days: DayTransport[]): DayTransport[] {
  return days.map((day) => ({
    ...day,
    legs: day.legs.map((leg): TransportLeg =>
      leg.mode === "walk"
        ? { ...leg, notes: "Short enough to walk — stay on the shaded side where you can." }
        : { ...leg, notes: DEMO_LEG_NOTE },
    ),
  }));
}

/** Demo stand-in for the model fallback path, when stops arrive without coordinates. */
function demoModelDayTransport(days: TripGenerateRequest["days"]): DayTransport[] {
  return days.map((d) => ({
    dayNumber: d.dayNumber,
    legs: d.stops.slice(0, -1).map((from, i) => ({
      from: from.name,
      to: d.stops[i + 1].name,
      mode: "ride_hail" as const,
      durationMinutes: 15,
      costSar: 20,
      uncertain: true,
      basis: "model" as const,
    })),
  }));
}

export async function runTransportAgent(
  req: TripGenerateRequest,
  demo: boolean,
): Promise<AgentOutcome<{ arrival: ArrivalTransport; dayTransport: DayTransport[] }>> {
  const hot = isHotMonth(monthFromIsoDate(req.dateStart));
  const estimated = estimateDayTransport(req.days, { hot });
  // A day with one stop has no legs and is legitimately complete; the model
  // path is only worth falling back to when coordinates were actually missing.
  const canCompute = estimated.every((d) => d.complete);

  if (demo) {
    await new Promise((r) => setTimeout(r, 800));
    return {
      ok: true,
      data: {
        arrival: DEMO_ARRIVAL,
        dayTransport: canCompute
          ? demoNotes(toDayTransport(estimated))
          : demoModelDayTransport(req.days),
      },
    };
  }

  try {
    const ai = getGemini();

    const arrivalCall = ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts: [{ text: arrivalPrompt(req) }] }],
      config: { responseMimeType: "application/json", responseSchema: arrivalSchema, temperature: 0.3 },
    });

    const secondCall = canCompute
      ? ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: [{ role: "user", parts: [{ text: legNotesPrompt(req, estimated, hot) }] }],
          config: { responseMimeType: "application/json", responseSchema: legNotesSchema, temperature: 0.4 },
        })
      : ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: [{ role: "user", parts: [{ text: modelDayTransportPrompt(req) }] }],
          config: { responseMimeType: "application/json", responseSchema: dayTransportSchema, temperature: 0.3 },
        });

    // allSettled, not all: in the computed path the second call is pure garnish,
    // so its failure must not cost the traveller a set of perfectly good legs.
    const [arrivalRes, secondRes] = await Promise.allSettled([arrivalCall, secondCall]);

    if (arrivalRes.status === "rejected" || !arrivalRes.value.text) {
      return { ok: false, error: "arrival call returned nothing" };
    }
    const arrival = parseJsonResponse<ArrivalTransport>(arrivalRes.value.text);

    const computed = toDayTransport(estimated);

    if (!canCompute) {
      if (secondRes.status === "rejected" || !secondRes.value.text) {
        return { ok: false, error: "day transport call returned nothing" };
      }
      const dayTransport = parseJsonResponse<{ days: DayTransport[] }>(secondRes.value.text).days;
      return {
        ok: true,
        data: { arrival, dayTransport: dayTransport.map((d) => ({ ...d, legs: d.legs.map((l) => ({ ...l, basis: "model" as const })) })) },
      };
    }

    if (secondRes.status === "rejected" || !secondRes.value.text) {
      logger.warn({ err: secondRes.status === "rejected" ? secondRes.reason : undefined },
        "Leg-notes refinement failed; returning computed legs unannotated");
      return { ok: true, data: { arrival, dayTransport: computed } };
    }

    let annotated = computed;
    try {
      annotated = applyLegNotes(computed, parseJsonResponse(secondRes.value.text));
    } catch (err) {
      logger.warn({ err }, "Leg-notes response was unparseable; returning computed legs unannotated");
    }

    return { ok: true, data: { arrival, dayTransport: annotated } };
  } catch (err) {
    logger.error({ err }, "Transportation agent failed");
    return { ok: false, error: err instanceof Error ? err.message : "unknown error" };
  }
}
