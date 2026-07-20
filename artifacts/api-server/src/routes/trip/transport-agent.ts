/**
 * Transportation Agent — one arrival recommendation for the whole trip, plus
 * intracity legs for each day, reasoned from that day's actual stop names.
 *
 * Two Gemini calls, not one: arrival and per-day transport use different
 * schemas (a flat object vs. an array keyed by day), and Gemini's structured
 * output needs a fixed schema per call — there is no way to express "return
 * either shape" in one responseSchema. Both calls run concurrently via
 * Promise.all in runTransportAgent, so this doesn't cost extra wall-clock time
 * against the day/arrival calls it replaces, only one extra request against
 * the free-tier quota.
 */
import { getGemini, GEMINI_MODEL, parseJsonResponse } from "../../lib/gemini";
import {
  arrivalSchema,
  dayTransportSchema,
  type ArrivalTransport,
  type DayTransport,
  type TripGenerateRequest,
  type AgentOutcome,
} from "./trip-types";
import { logger } from "../../lib/logger";

function arrivalPrompt(req: TripGenerateRequest): string {
  return `A traveller is arriving in ${req.cityDisplayName}, Saudi Arabia for a ${req.dateStart} to ${req.dateEnd} trip. Recommend how they most realistically get INTO the city (flight to the nearest airport, or intercity train/SAPTCO bus if that's genuinely the norm for this route) and then to their likely accommodation area. Give realistic SAR cost ranges and durations for Saudi Arabia — err toward typical/average figures, and set "uncertain" true on any leg where the specific cost or duration is a rough estimate rather than something you're confident about. Respond in ${req.languageName}.`;
}

function dayTransportPrompt(req: TripGenerateRequest): string {
  const days = req.days
    .map((d) => `Day ${d.dayNumber}: ${d.stopNames.join(" → ")}`)
    .join("\n");
  return `A traveller in ${req.cityDisplayName}, Saudi Arabia is visiting these places in this order, one line per day:

${days}

For each day, suggest how to get between consecutive stops — walking if they're genuinely close, otherwise taxi/ride-hail (the norm for getting around Saudi cities), giving a realistic SAR cost and duration estimate for each hop. You do not know the exact distance between two specific named places, so set "uncertain" true on every leg — this is general guidance, not a live route calculation. Respond in ${req.languageName}.`;
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
    },
  ],
  summary: "Fly into the city's main airport, then taxi or ride-hail to your accommodation area.",
};

function demoDayTransport(days: TripGenerateRequest["days"]): DayTransport[] {
  return days.map((d) => ({
    dayNumber: d.dayNumber,
    legs: d.stopNames.slice(0, -1).map((from, i) => ({
      from,
      to: d.stopNames[i + 1],
      mode: "ride_hail" as const,
      durationMinutes: 15,
      costSar: 20,
      uncertain: true,
    })),
  }));
}

export async function runTransportAgent(
  req: TripGenerateRequest,
  demo: boolean,
): Promise<AgentOutcome<{ arrival: ArrivalTransport; dayTransport: DayTransport[] }>> {
  if (demo) {
    await new Promise((r) => setTimeout(r, 800));
    return { ok: true, data: { arrival: DEMO_ARRIVAL, dayTransport: demoDayTransport(req.days) } };
  }

  try {
    const ai = getGemini();
    const [arrivalRes, dayRes] = await Promise.all([
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: [{ role: "user", parts: [{ text: arrivalPrompt(req) }] }],
        config: { responseMimeType: "application/json", responseSchema: arrivalSchema, temperature: 0.3 },
      }),
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: [{ role: "user", parts: [{ text: dayTransportPrompt(req) }] }],
        config: { responseMimeType: "application/json", responseSchema: dayTransportSchema, temperature: 0.3 },
      }),
    ]);

    if (!arrivalRes.text || !dayRes.text) return { ok: false, error: "empty response" };

    const arrival = parseJsonResponse<ArrivalTransport>(arrivalRes.text);
    const dayTransport = parseJsonResponse<{ days: DayTransport[] }>(dayRes.text).days;

    return { ok: true, data: { arrival, dayTransport } };
  } catch (err) {
    logger.error({ err }, "Transportation agent failed");
    return { ok: false, error: err instanceof Error ? err.message : "unknown error" };
  }
}
