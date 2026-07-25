import { describe, it, expect } from "vitest";
import { validateRequest } from "./trip-validate";

/**
 * The trip-generate validator is what keeps an untrusted body from reaching the
 * three agents. It also bounds the request — a caller sending a 10,000-stop day
 * shouldn't be able to blow up the enrichment call — so the caps are tested too.
 *
 * Since stops started carrying coordinates, it's also the gate in front of the
 * haversine in transport-estimate.ts: a bad lat/lng that slips through comes
 * back as a confident-looking distance computed from garbage, so the
 * coordinate-rejection cases below matter more than their size suggests.
 */
describe("validateRequest (trip/generate)", () => {
  const ok = {
    cityDisplayName: "Riyadh", dateStart: "2026-08-10", dateEnd: "2026-08-13",
    budgetSarPerDay: 600, travelType: "couple", languageName: "English",
    days: [{ dayNumber: 1, stops: [{ name: "Masmak", lat: 24.6883, lng: 46.7146 }] }],
    poiAreas: ["Olaya"],
  };

  it("accepts a well-formed request", () => {
    expect(validateRequest(ok)).toMatchObject({ cityDisplayName: "Riyadh", budgetSarPerDay: 600 });
  });

  it("rejects a blank city", () => {
    expect(validateRequest({ ...ok, cityDisplayName: "  " })).toBeNull();
  });

  it("rejects a non-numeric budget", () => {
    expect(validateRequest({ ...ok, budgetSarPerDay: "lots" })).toBeNull();
  });

  it("rejects when days or poiAreas isn't an array", () => {
    expect(validateRequest({ ...ok, days: "nope" })).toBeNull();
    expect(validateRequest({ ...ok, poiAreas: 5 })).toBeNull();
  });

  it("defaults languageName to English when absent", () => {
    const { languageName, ...rest } = ok;
    void languageName;
    expect(validateRequest(rest)?.languageName).toBe("English");
  });

  it("caps the number of days to keep the request bounded", () => {
    const many = Array.from({ length: 100 }, (_, i) => ({ dayNumber: i, stops: [] }));
    expect(validateRequest({ ...ok, days: many })!.days.length).toBeLessThanOrEqual(30);
  });

  it("caps stops per day", () => {
    const bigDay = [{
      dayNumber: 1,
      stops: Array.from({ length: 100 }, (_, i) => ({ name: `s${i}` })),
    }];
    expect(validateRequest({ ...ok, days: bigDay })!.days[0].stops.length).toBeLessThanOrEqual(20);
  });

  it("carries valid coordinates through to the estimator", () => {
    const stop = validateRequest(ok)!.days[0].stops[0];
    expect(stop).toEqual({ name: "Masmak", lat: 24.6883, lng: 46.7146 });
  });

  it("drops coordinates that aren't finite in-range numbers", () => {
    const bad = [
      { name: "a", lat: "24.7", lng: 46.7 },   // string
      { name: "b", lat: NaN, lng: 46.7 },      // NaN
      { name: "c", lat: 24.7 },                // half a pair
      { name: "d", lat: 24.7, lng: 999 },      // out of range
      { name: "e", lat: 91, lng: 46.7 },       // out of range
    ];
    const stops = validateRequest({ ...ok, days: [{ dayNumber: 1, stops: bad }] })!.days[0].stops;

    // Name survives; the unusable pair does not — the stop falls back to the
    // model path rather than feeding nonsense to haversine.
    expect(stops.map((s) => s.name)).toEqual(["a", "b", "c", "d", "e"]);
    for (const stop of stops) {
      expect(stop.lat).toBeUndefined();
      expect(stop.lng).toBeUndefined();
    }
  });

  it("tolerates a day with no stops array at all", () => {
    expect(validateRequest({ ...ok, days: [{ dayNumber: 1 }] })!.days[0].stops).toEqual([]);
  });
});
