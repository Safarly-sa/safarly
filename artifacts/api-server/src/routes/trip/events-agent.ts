/**
 * Events Agent — festivals, exhibitions, and seasonal programs that might
 * overlap the trip dates.
 *
 * NOT wired to live Google Search grounding, despite the API supporting it
 * (Tool.googleSearch). Two reasons: Gemini's grounded mode is not documented
 * as compatible with responseSchema structured output in the same call — the
 * usual pattern is a second, ungrounded call to reformat grounded findings,
 * which would double this agent's quota cost against a free tier already
 * shared 10 RPM / 250 RPD across all six agents and every user. And it cannot
 * be verified without a live key in this environment.
 *
 * So the safety net here is the "uncertain" field, not grounding. The prompt
 * defaults it to true and the model has no live calendar to check against —
 * treat every date range as "ask the venue," never as confirmed. This is a
 * deliberate, documented trade-off, not an oversight; revisit if grounding
 * gets verified against a real key.
 */
import { getGemini, GEMINI_MODEL, parseJsonResponse } from "../../lib/gemini";
import { eventsSchema, type TripEvent, type TripGenerateRequest, type AgentOutcome } from "./trip-types";
import { logger } from "../../lib/logger";

function prompt(req: TripGenerateRequest): string {
  return `You are a Saudi Arabia travel expert. A traveller will be in ${req.cityDisplayName}${
    req.cityDisplayNameAr ? ` (${req.cityDisplayNameAr})` : ""
  } from ${req.dateStart} to ${req.dateEnd}.

List festivals, exhibitions, seasonal programs, or major recurring cultural events that could plausibly be running in or near ${req.cityDisplayName} during that window — draw on well-known recurring Saudi programs (e.g. seasonal festivals, national celebrations, major exhibitions) where relevant to this city.

You have no live calendar access and cannot confirm exact current-year dates. Set "uncertain" to true on every event unless you are certain it is a fixed, well-known annual date (e.g. a national holiday) — err toward uncertain. Set "overlapsTrip" based on whether the event's typical season plausibly overlaps ${req.dateStart} to ${req.dateEnd}. If nothing plausible comes to mind, return an empty events array rather than inventing something.

Respond in ${req.languageName}.`;
}

const DEMO_EVENTS: TripEvent[] = [
  {
    name: "Seasonal cultural festival",
    description: "A city-wide program of concerts, markets, and light installations that typically runs across the cooler months.",
    category: "seasonal",
    dateRange: "Oct - Mar (typical)",
    overlapsTrip: true,
    uncertain: true,
    sourceHint: "Check the city's official tourism season program",
  },
  {
    name: "Local heritage exhibition",
    description: "A rotating exhibition on regional history and craft, usually hosted at a cultural district or museum.",
    category: "exhibition",
    dateRange: "Ongoing",
    overlapsTrip: true,
    uncertain: true,
  },
];

export async function runEventsAgent(
  req: TripGenerateRequest,
  demo: boolean,
): Promise<AgentOutcome<TripEvent[]>> {
  if (demo) {
    await new Promise((r) => setTimeout(r, 700));
    return { ok: true, data: DEMO_EVENTS };
  }

  try {
    const ai = getGemini();
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts: [{ text: prompt(req) }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: eventsSchema,
        temperature: 0.4,
      },
    });

    const text = response.text;
    if (!text) return { ok: false, error: "empty response" };

    const parsed = parseJsonResponse<{ events: TripEvent[] }>(text);
    return { ok: true, data: parsed.events };
  } catch (err) {
    logger.error({ err }, "Events agent failed");
    return { ok: false, error: err instanceof Error ? err.message : "unknown error" };
  }
}
