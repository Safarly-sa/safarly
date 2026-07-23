import { describe, it, expect } from "vitest";
import { applyEnrichment, buildEnrichRequest, type TripEnrichment } from "./trip-api";
import type { ItineraryResult, ItineraryDay } from "./engine";

/**
 * Enrichment is layered onto an already-built itinerary. The invariant that
 * matters: it is purely additive and non-mutating, so a failed or partial
 * enrichment never damages the trip the engine produced.
 */

function day(dayNumber: number): ItineraryDay {
  return {
    date: "2026-08-10", dayNumber, stops: [], meals: [],
    dailyCostSar: 0, overBudget: false, prayerGaps: [],
  };
}

function result(days: ItineraryDay[]): ItineraryResult {
  return {
    days, objectives: { culture: 1, budget: 0, hiddenGems: 0, food: 0, family: 0, photography: 0 },
    totalCostSar: 0, verifiedCount: 0, allergenSafeDishCount: 0, candidateCount: 0,
    hiddenGemShare: 0, cultureNoteCount: 0, cityName: "Riyadh",
    resolvedCity: "riyadh", budgetStatus: "ok", estimatedDailyAvg: 0,
  };
}

const enrichment: TripEnrichment = {
  events: [{ name: "E", description: "d", category: "festival", dateRange: "Aug", overlapsTrip: true, uncertain: false }],
  arrival: { legs: [{ from: "A", to: "B", mode: "flight", durationMinutes: 90, costSar: 100, uncertain: false }], summary: "s" },
  dayTransport: [{ dayNumber: 2, legs: [{ from: "H", to: "M", mode: "walk", durationMinutes: 20, costSar: 0, uncertain: false }] }],
  accommodation: [{ area: "Olaya", whyThisArea: "central", hotelType: "mid", nightlyCostSarLow: 300, nightlyCostSarHigh: 500, goodFor: "couples" }],
};

describe("applyEnrichment", () => {
  it("attaches events, arrival and accommodation to the result", () => {
    const next = applyEnrichment(result([day(1), day(2)]), enrichment);
    expect(next.events).toHaveLength(1);
    expect(next.arrival?.legs).toHaveLength(1);
    expect(next.accommodation).toHaveLength(1);
  });

  it("folds day transport onto the matching day only", () => {
    const next = applyEnrichment(result([day(1), day(2)]), enrichment);
    expect(next.days[0].transportLegs).toBeUndefined(); // no legs for day 1
    expect(next.days[1].transportLegs).toHaveLength(1);
  });

  it("does not mutate the input itinerary", () => {
    const base = result([day(1), day(2)]);
    const snapshot = JSON.stringify(base);
    applyEnrichment(base, enrichment);
    expect(JSON.stringify(base)).toBe(snapshot);
    expect(base.events).toBeUndefined();
  });
});

describe("buildEnrichRequest", () => {
  it("carries day stop names and stays within the poiAreas cap", () => {
    const base = result([day(1)]);
    const req = buildEnrichRequest({
      itinerary: base, dateStart: "2026-08-10", dateEnd: "2026-08-11",
      budgetSarPerDay: 600, travelType: "couple", languageName: "English",
    });
    expect(req.cityDisplayName).toBe("Riyadh");
    expect(req.days).toHaveLength(1);
    expect(req.poiAreas.length).toBeLessThanOrEqual(12);
  });
});
