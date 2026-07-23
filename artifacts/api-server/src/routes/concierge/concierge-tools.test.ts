import { describe, it, expect } from "vitest";
import { validateItineraryActions, buildPatch } from "./concierge-tools";
import type { ConciergeDay, ConciergePoi } from "./concierge-types";

/**
 * This is the server-side guard that stops a model-proposed edit from touching
 * anything real unless it references an id that ACTUALLY EXISTS — an existing
 * stop, or a candidate the client explicitly offered. It's the "model proposes,
 * code enforces" split; if it regresses, the concierge could insert invented
 * places or delete the wrong stop. Hence tests.
 */

const poi = (id: string): ConciergePoi => ({ id, name: id, category: "heritage", durationHrs: 1, hiddenGem: false });

const days: ConciergeDay[] = [
  { dayNumber: 1, stops: [poi("a"), poi("b"), poi("c")] },
  { dayNumber: 2, stops: [poi("d")] },
];
const candidates: ConciergePoi[] = [poi("x"), poi("y")];

describe("validateItineraryActions", () => {
  it("keeps a remove that names an existing stop", () => {
    const out = validateItineraryActions([{ type: "remove_stop", dayNumber: 1, poiId: "a" }], days, candidates);
    expect(out).toEqual([{ type: "remove_stop", dayNumber: 1, poiId: "a" }]);
  });

  it("drops a remove for an id not on that day", () => {
    expect(validateItineraryActions([{ type: "remove_stop", dayNumber: 1, poiId: "d" }], days, candidates)).toEqual([]);
  });

  it("keeps an add only for a candidate id with a valid slot", () => {
    const out = validateItineraryActions([{ type: "add_stop", dayNumber: 1, poiId: "x", slot: "evening" }], days, candidates);
    expect(out).toHaveLength(1);
  });

  it("drops an add whose id is not in the candidate list (the invented-place guard)", () => {
    expect(validateItineraryActions([{ type: "add_stop", dayNumber: 1, poiId: "zzz", slot: "evening" }], days, candidates)).toEqual([]);
  });

  it("drops an add with an invalid slot", () => {
    expect(validateItineraryActions([{ type: "add_stop", dayNumber: 1, poiId: "x", slot: "midnight" as never }], days, candidates)).toEqual([]);
  });

  it("keeps a swap when the removed id exists and the added id is a candidate", () => {
    const out = validateItineraryActions([{ type: "swap_stop", dayNumber: 1, removePoiId: "a", addPoiId: "x", slot: "morning" }], days, candidates);
    expect(out).toHaveLength(1);
  });

  it("drops a swap that tries to add a non-candidate", () => {
    expect(validateItineraryActions([{ type: "swap_stop", dayNumber: 1, removePoiId: "a", addPoiId: "b", slot: "morning" }], days, candidates)).toEqual([]);
  });

  it("keeps a reorder that is a true permutation of the day's stops", () => {
    const out = validateItineraryActions([{ type: "reorder_day", dayNumber: 1, stopOrder: ["c", "a", "b"] }], days, candidates);
    expect(out).toHaveLength(1);
  });

  it("drops a reorder with a duplicate id", () => {
    expect(validateItineraryActions([{ type: "reorder_day", dayNumber: 1, stopOrder: ["a", "a", "b"] }], days, candidates)).toEqual([]);
  });

  it("drops a reorder that adds or omits an id", () => {
    expect(validateItineraryActions([{ type: "reorder_day", dayNumber: 1, stopOrder: ["a", "b"] }], days, candidates)).toEqual([]);
    expect(validateItineraryActions([{ type: "reorder_day", dayNumber: 1, stopOrder: ["a", "b", "c", "x"] }], days, candidates)).toEqual([]);
  });

  it("drops actions against a non-existent day", () => {
    expect(validateItineraryActions([{ type: "remove_stop", dayNumber: 9, poiId: "a" }], days, candidates)).toEqual([]);
  });

  it("keeps valid actions while dropping invalid ones in the same batch", () => {
    const out = validateItineraryActions([
      { type: "remove_stop", dayNumber: 1, poiId: "a" }, // valid
      { type: "add_stop", dayNumber: 1, poiId: "zzz", slot: "evening" }, // invalid
    ], days, candidates);
    expect(out).toHaveLength(1);
  });

  it("returns nothing for non-array input", () => {
    expect(validateItineraryActions(null, days, candidates)).toEqual([]);
    expect(validateItineraryActions("oops", days, candidates)).toEqual([]);
  });
});

describe("buildPatch", () => {
  it("validates actions and truncates an over-long summary", () => {
    const patch = buildPatch(
      { actions: [{ type: "remove_stop", dayNumber: 1, poiId: "a" }], summary: "x".repeat(500) },
      days, candidates,
    );
    expect(patch.actions).toHaveLength(1);
    expect(patch.summary.length).toBeLessThanOrEqual(300);
  });

  it("tolerates a missing summary", () => {
    const patch = buildPatch({ actions: [] }, days, candidates);
    expect(patch.summary).toBe("");
    expect(patch.actions).toEqual([]);
  });
});
