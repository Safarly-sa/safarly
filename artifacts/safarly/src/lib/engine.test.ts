import { describe, it, expect } from "vitest";
import {
  generateItinerary,
  isVerified,
  recalcDay,
  recalcTotals,
  scheduleStop,
  type ItineraryResult,
  type POI,
  type TravelerProfile,
  type TripSpec,
} from "./engine";

/**
 * The engine is the app's core: every itinerary in the product comes out of
 * generateItinerary, and the whole trip is generated client-side with no server
 * check behind it. These tests pin the invariants the rest of the app relies on
 * — a real city gets scheduled, days carry stops, cost reflects the stops — plus
 * the post-generation editing primitives the concierge builds on.
 */

const baseProfile: TravelerProfile = {
  nationality: "GB", language: "en", ageRange: "25-34", dietary: "none",
  allergies: [], travelType: "couple", accessibility: false,
  interests: ["history", "food"],
};

const tripFor = (city: string, days: number): TripSpec => {
  const end = new Date("2026-08-10");
  end.setDate(end.getDate() + days - 1);
  return {
    city, dateStart: "2026-08-10", dateEnd: end.toISOString().slice(0, 10),
    budget: 600, moods: ["culture"], goals: ["culture"], travelContext: "couple",
  };
};

describe("generateItinerary", () => {
  it("produces one day per calendar day with stops on each", () => {
    const r = generateItinerary(baseProfile, tripFor("riyadh", 3));
    expect(r.days).toHaveLength(3);
    for (const day of r.days) {
      expect(day.stops.length).toBeGreaterThan(0);
      expect(day.dayNumber).toBeGreaterThan(0);
    }
  });

  it("resolves each real city to its own name and dataset", () => {
    for (const city of ["riyadh", "jeddah", "alula"]) {
      const r = generateItinerary(baseProfile, tripFor(city, 2));
      expect(r.resolvedCity).toBe(city);
      // Every scheduled POI belongs to the resolved city's dataset.
      for (const stop of r.days.flatMap((d) => d.stops)) {
        expect(stop.poi.city).toBe(city);
      }
    }
  });

  it("maps a city without its own POIs onto a backing dataset while keeping its real name", () => {
    // taif has no dataset of its own; CITY_POI_MAP backs it with jeddah's.
    const r = generateItinerary(baseProfile, tripFor("taif", 2));
    expect(r.cityName.toLowerCase()).toContain("taif");
    expect(r.days.flatMap((d) => d.stops).length).toBeGreaterThan(0);
  });

  it("resolves an 'ai' city choice to a concrete city", () => {
    const r = generateItinerary(baseProfile, tripFor("ai", 2));
    expect(r.resolvedCity).not.toBe("ai");
    expect(r.days.flatMap((d) => d.stops).length).toBeGreaterThan(0);
  });

  it("does not schedule the same POI twice across the trip", () => {
    const r = generateItinerary(baseProfile, tripFor("riyadh", 3));
    const ids = r.days.flatMap((d) => d.stops.map((s) => s.poi.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("reports a total cost equal to the sum of its days", () => {
    const r = generateItinerary(baseProfile, tripFor("jeddah", 3));
    const summed = r.days.reduce((s, d) => s + d.dailyCostSar, 0);
    expect(r.totalCostSar).toBe(summed);
  });
});

describe("scheduleStop", () => {
  const poi: POI = {
    id: "x", name: "X", city: "riyadh", category: "heritage",
    lat: 24.7, lng: 46.7, price_range: 0, duration_hrs: 2,
    hidden_gem: false, family_friendly: true, accessible: true,
    indoor: true, best_slot: "morning", map_url: "map:x",
  };

  it("places a stop on the slot clock with an end after its start", () => {
    const stop = scheduleStop(poi, "morning");
    expect(stop.slot).toBe("morning");
    expect(stop.startTime < stop.endTime).toBe(true);
  });

  it("uses different start times for different slots", () => {
    const morning = scheduleStop(poi, "morning").startTime;
    const evening = scheduleStop(poi, "evening").startTime;
    expect(morning).not.toBe(evening);
    expect(morning < evening).toBe(true);
  });
});

describe("recalcDay / recalcTotals", () => {
  const poi = (id: string, price: number): POI => ({
    id, name: id, city: "riyadh", category: "heritage",
    lat: 24.7, lng: 46.7, price_range: price, duration_hrs: 1,
    hidden_gem: false, family_friendly: true, accessible: true,
    indoor: true, best_slot: "morning", map_url: `map:${id}`,
  });

  it("flags a day over budget from its stop and meal costs", () => {
    const day = {
      date: "2026-08-10", dayNumber: 1,
      stops: [scheduleStop(poi("a", 400), "morning")],
      meals: [], dailyCostSar: 0, overBudget: false, prayerGaps: [],
    };
    const recalced = recalcDay(day, 300);
    expect(recalced.dailyCostSar).toBe(400);
    expect(recalced.overBudget).toBe(true);
  });

  it("re-derives budgetStatus at the result level", () => {
    const day = {
      date: "2026-08-10", dayNumber: 1,
      stops: [scheduleStop(poi("a", 800), "morning")],
      meals: [], dailyCostSar: 0, overBudget: false, prayerGaps: [],
    };
    const result: ItineraryResult = {
      days: [day], objectives: { culture: 1, budget: 0, hiddenGems: 0, food: 0, family: 0, photography: 0 },
      totalCostSar: 0, verifiedCount: 0, allergenSafeDishCount: 0, candidateCount: 0,
      hiddenGemShare: 0, cultureNoteCount: 0, cityName: "Riyadh",
      resolvedCity: "riyadh", budgetStatus: "ok", estimatedDailyAvg: 0,
    };
    const recalced = recalcTotals(result, 300);
    expect(recalced.totalCostSar).toBe(800);
    expect(recalced.budgetStatus).toBe("over");
  });
});

describe("isVerified", () => {
  const poi = (over: Partial<POI>): POI => ({
    id: "x", name: "X", city: "riyadh", category: "heritage",
    lat: 24.7, lng: 46.7, price_range: 0, duration_hrs: 1,
    hidden_gem: false, family_friendly: true, accessible: true,
    indoor: true, best_slot: "morning", map_url: "map:x", ...over,
  });

  it("treats a missing flag as verified (predates the field)", () => {
    expect(isVerified(poi({ verified: undefined }))).toBe(true);
  });

  it("is false for an authored entry even with a map link", () => {
    expect(isVerified(poi({ verified: false }))).toBe(false);
  });

  it("is false when there is no map link to check against", () => {
    expect(isVerified(poi({ verified: true, map_url: "" }))).toBe(false);
  });
});
