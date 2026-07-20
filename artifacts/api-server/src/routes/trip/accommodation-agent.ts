/**
 * Accommodation Agent — recommends AREAS and hotel types, never a specific
 * bookable property. Out of scope explicitly excludes booking; recommending a
 * named hotel we have no live availability/pricing for would look like a
 * booking-grade claim without being one.
 */
import { getGemini, GEMINI_MODEL, parseJsonResponse } from "../../lib/gemini";
import {
  accommodationSchema,
  type AccommodationOption,
  type TripGenerateRequest,
  type AgentOutcome,
} from "./trip-types";
import { logger } from "../../lib/logger";

function prompt(req: TripGenerateRequest): string {
  const areas = req.poiAreas.length > 0
    ? `Their itinerary centres on: ${req.poiAreas.join(", ")}.`
    : "";

  return `A traveller is visiting ${req.cityDisplayName}, Saudi Arabia from ${req.dateStart} to ${req.dateEnd}, budget approximately ${req.budgetSarPerDay} SAR/day, travelling as: ${req.travelType}. ${areas}

Recommend 2-3 AREAS or neighbourhoods to stay in (not specific hotels — we have no live booking data) that minimise travel time to the places on their itinerary, and suit their budget and travel context. For each, give a realistic nightly cost RANGE in SAR for the hotel type you're suggesting, and explain briefly why that area fits their specific itinerary and travel context. Respond in ${req.languageName}.`;
}

const DEMO_ACCOMMODATION: AccommodationOption[] = [
  {
    area: "City centre / Olaya district",
    whyThisArea: "Central and well-connected to most of the itinerary's stops, with easy ride-hail access to sites further out.",
    hotelType: "mid-range",
    nightlyCostSarLow: 300,
    nightlyCostSarHigh: 550,
    goodFor: "Most travellers wanting a central base with dining and transport options nearby.",
  },
  {
    area: "Historic district",
    whyThisArea: "Closer to the heritage and cultural sites on the itinerary; a shorter first/last stop of the day.",
    hotelType: "boutique",
    nightlyCostSarLow: 250,
    nightlyCostSarHigh: 450,
    goodFor: "Travellers prioritising walkability to cultural sites over nightlife or shopping.",
  },
];

export async function runAccommodationAgent(
  req: TripGenerateRequest,
  demo: boolean,
): Promise<AgentOutcome<AccommodationOption[]>> {
  if (demo) {
    await new Promise((r) => setTimeout(r, 650));
    return { ok: true, data: DEMO_ACCOMMODATION };
  }

  try {
    const ai = getGemini();
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts: [{ text: prompt(req) }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: accommodationSchema,
        temperature: 0.3,
      },
    });

    const text = response.text;
    if (!text) return { ok: false, error: "empty response" };

    const parsed = parseJsonResponse<{ accommodation: AccommodationOption[] }>(text);
    return { ok: true, data: parsed.accommodation };
  } catch (err) {
    logger.error({ err }, "Accommodation agent failed");
    return { ok: false, error: err instanceof Error ? err.message : "unknown error" };
  }
}
