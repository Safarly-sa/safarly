import { describe, it, expect } from "vitest";
import { applyConciergePatch, buildConciergeState, type ConciergeAction } from "./concierge-api";
import { scheduleStop, type ItineraryResult, type ItineraryDay, type ItineraryStop, type POI } from "./engine";

/**
 * The concierge is the one path that MUTATES a real itinerary from model output,
 * so these tests pin the invariants that keep a bad suggestion from corrupting a
 * trip: only known ids are applied, the original object is never mutated, and
 * cost is re-derived rather than left stale.
 */

function poi(id: string, over: Partial<POI> = {}): POI {
  return {
    id, name: id, city: "riyadh", category: "heritage",
    lat: 24.7, lng: 46.7, price_range: 0, duration_hrs: 1.5,
    hidden_gem: false, family_friendly: true, accessible: true,
    indoor: true, best_slot: "morning", map_url: `map:${id}`,
    ...over,
  };
}

function day(dayNumber: number, pois: POI[], slots: ItineraryStop["slot"][] = []): ItineraryDay {
  const stops = pois.map((p, i) => scheduleStop(p, slots[i] ?? "morning"));
  return {
    date: "2026-08-10", dayNumber, stops, meals: [],
    dailyCostSar: pois.reduce((s, p) => s + p.price_range, 0),
    overBudget: false, prayerGaps: [],
  };
}

function result(days: ItineraryDay[]): ItineraryResult {
  return {
    days, objectives: { culture: 1, budget: 0, hiddenGems: 0, food: 0, family: 0, photography: 0 },
    totalCostSar: days.reduce((s, d) => s + d.dailyCostSar, 0),
    verifiedCount: 0, allergenSafeDishCount: 0, candidateCount: 0,
    hiddenGemShare: 0, cultureNoteCount: 0, cityName: "Riyadh",
    resolvedCity: "riyadh", budgetStatus: "ok", estimatedDailyAvg: 0,
  };
}

const patch = (actions: ConciergeAction[]) => ({ actions, summary: "" });

describe("applyConciergePatch", () => {
  it("removes a stop that exists and re-derives day cost", () => {
    const base = result([day(1, [poi("a", { price_range: 30 }), poi("b", { price_range: 60 })], ["morning", "midday"])]);
    const { result: next, appliedCount } = applyConciergePatch(
      base, patch([{ type: "remove_stop", dayNumber: 1, poiId: "b" }]),
      new Map(), 600,
    );
    expect(appliedCount).toBe(1);
    expect(next.days[0].stops.map((s) => s.poi.id)).toEqual(["a"]);
    expect(next.days[0].dailyCostSar).toBe(30);
    expect(next.totalCostSar).toBe(30);
  });

  it("ignores a remove referencing an id not on the day", () => {
    const base = result([day(1, [poi("a")])]);
    const { result: next, appliedCount } = applyConciergePatch(
      base, patch([{ type: "remove_stop", dayNumber: 1, poiId: "ghost" }]),
      new Map(), 600,
    );
    expect(appliedCount).toBe(0);
    expect(next).toBe(base); // no change -> same reference, cheap for React
  });

  it("adds a candidate POI and keeps the day chronological", () => {
    const base = result([day(1, [poi("a")], ["morning"])]);
    const cand = poi("z", { best_slot: "evening" });
    const { result: next, appliedCount } = applyConciergePatch(
      base, patch([{ type: "add_stop", dayNumber: 1, poiId: "z", slot: "evening" }]),
      new Map([["z", cand]]), 600,
    );
    expect(appliedCount).toBe(1);
    const times = next.days[0].stops.map((s) => s.startTime);
    expect([...times]).toEqual([...times].sort());
    expect(next.days[0].stops.map((s) => s.poi.id)).toContain("z");
  });

  it("does not add a POI the client can't resolve", () => {
    const base = result([day(1, [poi("a")])]);
    const { appliedCount } = applyConciergePatch(
      base, patch([{ type: "add_stop", dayNumber: 1, poiId: "z", slot: "evening" }]),
      new Map(), 600, // empty registry
    );
    expect(appliedCount).toBe(0);
  });

  it("swaps only when the removed id exists and the added id resolves", () => {
    const base = result([day(1, [poi("a"), poi("b")])]);
    const cand = poi("z");
    const { result: next, appliedCount } = applyConciergePatch(
      base, patch([{ type: "swap_stop", dayNumber: 1, removePoiId: "a", addPoiId: "z", slot: "morning" }]),
      new Map([["z", cand]]), 600,
    );
    expect(appliedCount).toBe(1);
    const ids = next.days[0].stops.map((s) => s.poi.id);
    expect(ids).toContain("z");
    expect(ids).not.toContain("a");
    expect(ids).toContain("b");
  });

  it("reorders and reassigns the slot clock positionally", () => {
    const base = result([day(1, [poi("a"), poi("b"), poi("c")], ["morning", "midday", "afternoon"])]);
    const { result: next, appliedCount } = applyConciergePatch(
      base, patch([{ type: "reorder_day", dayNumber: 1, stopOrder: ["c", "b", "a"] }]),
      new Map(), 600,
    );
    expect(appliedCount).toBe(1);
    expect(next.days[0].stops.map((s) => s.poi.id)).toEqual(["c", "b", "a"]);
    const times = next.days[0].stops.map((s) => s.startTime);
    expect([...times]).toEqual([...times].sort()); // timestamps still ascending
  });

  it("rejects a reorder whose id set differs from the day's", () => {
    const base = result([day(1, [poi("a"), poi("b")])]);
    const { appliedCount } = applyConciergePatch(
      base, patch([{ type: "reorder_day", dayNumber: 1, stopOrder: ["a", "b", "a"] }]),
      new Map(), 600,
    );
    expect(appliedCount).toBe(0);
  });

  it("ignores actions targeting a day that doesn't exist", () => {
    const base = result([day(1, [poi("a")])]);
    const { appliedCount } = applyConciergePatch(
      base, patch([{ type: "remove_stop", dayNumber: 99, poiId: "a" }]),
      new Map(), 600,
    );
    expect(appliedCount).toBe(0);
  });

  it("never mutates the input itinerary", () => {
    const base = result([day(1, [poi("a"), poi("b")])]);
    const snapshot = JSON.stringify(base);
    applyConciergePatch(base, patch([{ type: "remove_stop", dayNumber: 1, poiId: "a" }]), new Map(), 600);
    expect(JSON.stringify(base)).toBe(snapshot);
  });

  it("applies independent actions and skips only the invalid ones", () => {
    const base = result([day(1, [poi("a"), poi("b")]), day(2, [poi("c")])]);
    const { appliedCount } = applyConciergePatch(
      base,
      patch([
        { type: "remove_stop", dayNumber: 1, poiId: "a" }, // valid
        { type: "remove_stop", dayNumber: 2, poiId: "ghost" }, // invalid
      ]),
      new Map(), 600,
    );
    expect(appliedCount).toBe(1);
  });
});

describe("buildConciergeState", () => {
  it("offers only city POIs that aren't already scheduled", () => {
    const base = result([day(1, [poi("a"), poi("b")])]);
    const all = [poi("a"), poi("b"), poi("c"), poi("d")];
    const state = buildConciergeState(base, all);
    const ids = state.candidatePois.map((p) => p.id).sort();
    expect(ids).toEqual(["c", "d"]);
    expect(state.cityDisplayName).toBe("Riyadh");
  });

  it("caps the candidate list so the request stays bounded", () => {
    const base = result([day(1, [poi("a")])]);
    const all = [poi("a"), ...Array.from({ length: 150 }, (_, i) => poi(`p${i}`))];
    const state = buildConciergeState(base, all);
    expect(state.candidatePois.length).toBeLessThanOrEqual(100);
  });
});
