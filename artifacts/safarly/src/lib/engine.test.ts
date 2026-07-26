import { describe, it, expect } from "vitest";
import {
  generateItinerary,
  isVerified,
  optimizeDayStops,
  recalcDay,
  recalcTotals,
  scheduleStop,
  type ItineraryResult,
  type ItineraryStop,
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

describe("optimizeDayStops", () => {
  /**
   * Coordinates deliberately laid out so morning-order (A, B, C, D) is a
   * detour and the shortest path visits them in a different order — the
   * thing a full permutation search finds and a single fixed swap can't.
   */
  const at = (id: string, lat: number, lng: number, indoor = true): POI => ({
    id, name: id, city: "riyadh", category: "heritage",
    lat, lng, price_range: 0, duration_hrs: 1,
    hidden_gem: false, family_friendly: true, accessible: true,
    indoor, best_slot: "morning", map_url: `map:${id}`,
  });

  const stopAt = (poi: POI, slot: ItineraryStop["slot"]): ItineraryStop => scheduleStop(poi, slot);

  it("leaves fewer than two stops untouched", () => {
    const one = [stopAt(at("a", 24.0, 46.0), "morning")];
    expect(optimizeDayStops(one)).toEqual({ stops: one, reordered: false, distanceSaved: 0 });
    expect(optimizeDayStops([])).toEqual({ stops: [], reordered: false, distanceSaved: 0 });
  });

  it("does not reorder when the given arrangement is already shortest", () => {
    // Monotonically increasing along one axis: already optimal in slot order.
    const stops = [
      stopAt(at("a", 24.0, 46.0), "morning"),
      stopAt(at("b", 24.1, 46.0), "midday"),
      stopAt(at("c", 24.2, 46.0), "afternoon"),
      stopAt(at("d", 24.3, 46.0), "evening"),
    ];
    const result = optimizeDayStops(stops);
    expect(result.reordered).toBe(false);
    expect(result.distanceSaved).toBe(0);
    // Content-equal, not necessarily the same array/object references — the
    // function always rebuilds (see the stale-duration regression test
    // below for why that matters), so `.stops` is a fresh array even here.
    expect(result.stops.map((s) => [s.poi.id, s.slot])).toEqual(
      stops.map((s) => [s.poi.id, s.slot]),
    );
  });

  it("finds a shorter arrangement a single swap can't reach", () => {
    // A cluster at lng 46.0 and a cluster at lng 47.0. Feeding them in as
    // A(46.0) B(47.0) C(46.0) D(47.0) crosses the gap three times; grouping
    // by cluster crosses it once. A midday/afternoon-only swap can't produce
    // that regrouping — only a full permutation search can.
    const stops = [
      stopAt(at("a", 24.0, 46.0), "morning"),
      stopAt(at("b", 24.0, 47.0), "midday"),
      stopAt(at("c", 24.0, 46.0), "afternoon"),
      stopAt(at("d", 24.0, 47.0), "evening"),
    ];
    const result = optimizeDayStops(stops);
    expect(result.reordered).toBe(true);
    expect(result.distanceSaved).toBeGreaterThan(0);

    // Same four POIs, still one per slot, now grouped so the 1.0-lng gap is
    // crossed only once instead of three times.
    expect(result.stops).toHaveLength(4);
    expect(new Set(result.stops.map((s) => s.poi.id))).toEqual(new Set(["a", "b", "c", "d"]));
    const crossings = result.stops.filter((s, i) =>
      i > 0 && s.poi.lng !== result.stops[i - 1].poi.lng
    ).length;
    expect(crossings).toBeLessThan(3);
  });

  it("never assigns a non-indoor stop to the midday slot", () => {
    // The only non-indoor POI (b) would shorten the route if placed in
    // midday — the optimizer has to reject that arrangement anyway.
    const stops = [
      stopAt(at("a", 24.0, 46.00), "morning"),
      stopAt(at("b", 24.0, 46.05, /* indoor */ false), "midday"),
      stopAt(at("c", 24.0, 46.10), "afternoon"),
      stopAt(at("d", 24.0, 46.15), "evening"),
    ];
    const result = optimizeDayStops(stops);
    const midday = result.stops.find((s) => s.slot === "midday");
    expect(midday?.poi.indoor).toBe(true);
  });

  it("gives every returned stop consistent slot/startTime/endTime/prayerGapBefore", () => {
    const stops = [
      stopAt(at("a", 24.0, 47.0), "morning"),
      stopAt(at("b", 24.0, 46.0), "midday"),
      stopAt(at("c", 24.0, 47.0), "afternoon"),
      stopAt(at("d", 24.0, 46.0), "evening"),
    ];
    const result = optimizeDayStops(stops);
    for (const s of result.stops) {
      const expected = scheduleStop(s.poi, s.slot);
      expect(s.startTime).toBe(expected.startTime);
      expect(s.endTime).toBe(expected.endTime);
      expect(s.prayerGapBefore).toBe(expected.prayerGapBefore);
    }
  });

  it("does not mutate the input array", () => {
    const stops = [
      stopAt(at("a", 24.0, 47.0), "morning"),
      stopAt(at("b", 24.0, 46.0), "midday"),
      stopAt(at("c", 24.0, 47.0), "afternoon"),
      stopAt(at("d", 24.0, 46.0), "evening"),
    ];
    const before = stops.map((s) => ({ ...s }));
    optimizeDayStops(stops);
    expect(stops).toEqual(before);
  });

  /**
   * Regression test for a real bug caught by browser verification: the
   * venue-closure flow in itinerary.tsx builds its replacement array by
   * filtering out the closed stop (preserving the survivors' relative order)
   * and APPENDING the replacement at the end — so a removed midday stop's
   * replacement lands at array index 3, not 1. Trusting array position to
   * mean slot order (the original implementation) would then check the
   * WRONG stop against the midday-indoor rule, letting an outdoor
   * replacement stand in the heat slot unchecked.
   */
  it("sorts by each stop's own slot field rather than trusting array position", () => {
    const outdoorReplacement = at("replacement", 24.0, 46.02, /* indoor */ false);
    // Array order: morning, afternoon, evening, THEN the midday replacement
    // appended out of place — exactly what the closure flow constructs.
    const outOfOrder = [
      stopAt(at("a", 24.0, 46.00), "morning"),
      stopAt(at("c", 24.0, 46.03), "afternoon"),
      stopAt(at("d", 24.0, 46.04), "evening"),
      stopAt(outdoorReplacement, "midday"),
    ];

    const result = optimizeDayStops(outOfOrder);
    const midday = result.stops.find((s) => s.slot === "midday");
    expect(midday?.poi.indoor).toBe(true);
    expect(midday?.poi.id).not.toBe("replacement");
  });

  /**
   * Regression test for the other half of the same real bug: the
   * closure flow builds a replacement stop by copying the CLOSED stop's
   * startTime/endTime rather than deriving one from the replacement's own
   * duration_hrs. Even when the assignment doesn't change (no shorter
   * arrangement exists), the returned stop must carry ITS OWN duration, not
   * a stale one borrowed from whatever it replaced.
   */
  it("corrects a stop's stale startTime/endTime even when the assignment doesn't change", () => {
    const shortStop = at("short", 24.0, 46.00, true);   // duration_hrs: 1 via `at`'s default
    const longPoi: POI = { ...at("long", 24.0, 46.01, true), duration_hrs: 3 };

    // Hand-built, mimicking the closure flow: `long` sits in the midday slot
    // but with `short`'s 1-hour time footprint, not its own 3-hour one.
    const staleStop: ItineraryStop = {
      poi: longPoi,
      slot: "midday",
      startTime: scheduleStop(shortStop, "midday").startTime,
      endTime:   scheduleStop(shortStop, "midday").endTime, // wrong: 1hr, not 3hr
      prayerGapBefore: "12:00",
    };
    const stops = [stopAt(at("a", 24.0, 45.99), "morning"), staleStop];

    const result = optimizeDayStops(stops);
    const fixed = result.stops.find((s) => s.poi.id === "long")!;
    const correct = scheduleStop(longPoi, fixed.slot);
    expect(fixed.endTime).toBe(correct.endTime);
    expect(fixed.endTime).not.toBe(staleStop.endTime);
  });

  /**
   * The live bug this whole describe block chases down: a day where every
   * stop is outdoor (reachable via the venue-closure flow — it doesn't check
   * indoor when picking a replacement, and a day commonly has only ONE
   * indoor stop, the one scorePoi reserved for midday). No valid arrangement
   * exists, so the midday-indoor rule can't be satisfied — but that must not
   * be an excuse to also leave a stale time footprint uncorrected.
   */
  it("still corrects stale duration on a day with no valid arrangement at all", () => {
    const shortStop = at("short", 24.0, 46.00, false);
    const longPoi: POI = { ...at("long", 24.0, 46.01, false), duration_hrs: 3 };
    const staleStop: ItineraryStop = {
      poi: longPoi,
      slot: "midday",
      startTime: scheduleStop(shortStop, "midday").startTime,
      endTime:   scheduleStop(shortStop, "midday").endTime, // wrong: 1hr, not 3hr
      prayerGapBefore: "12:00",
    };
    const stops = [stopAt(at("a", 24.0, 45.99, false), "morning"), staleStop];

    const result = optimizeDayStops(stops);
    // Can't fix the indoor rule — nothing indoor exists today.
    expect(result.stops.find((s) => s.slot === "midday")?.poi.indoor).toBe(false);
    // Can, and must, still fix the duration.
    const fixed = result.stops.find((s) => s.poi.id === "long")!;
    expect(fixed.endTime).toBe(scheduleStop(longPoi, fixed.slot).endTime);
    expect(fixed.endTime).not.toBe(staleStop.endTime);
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
