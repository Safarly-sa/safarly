import { describe, it, expect } from "vitest";
import {
  estimateDayTransport,
  estimateLeg,
  haversineKm,
  isHotMonth,
  monthFromIsoDate,
} from "./transport-estimate";

/**
 * These are the numbers that used to be model guesses, so they're worth
 * pinning: the whole point of computing them is that they stop moving.
 *
 * Real coordinates from artifacts/safarly/src/data/pois.json, so a regression
 * here means the itinerary's actual distances changed, not that a fixture did.
 */
const MASMAK = { name: "Al-Masmak Fortress", lat: 24.6883, lng: 46.7146 };
const NAT_MUSEUM = { name: "National Museum", lat: 24.691, lng: 46.708 };
const DIRIYAH = { name: "Diriyah At-Turaif", lat: 24.7341, lng: 46.5751 };
const BUJAIRI = { name: "Al-Bujairi Heritage Park", lat: 24.7363, lng: 46.5758 };

describe("haversineKm", () => {
  it("is zero for a point against itself", () => {
    expect(haversineKm(MASMAK, MASMAK)).toBe(0);
  });

  it("matches the known short distance across central Riyadh", () => {
    // Masmak → National Museum is a well-known ~700m walk.
    expect(haversineKm(MASMAK, NAT_MUSEUM)).toBeCloseTo(0.71, 1);
  });

  it("matches the known distance out to Diriyah", () => {
    expect(haversineKm(MASMAK, DIRIYAH)).toBeCloseTo(14.7, 0);
  });

  it("is symmetric", () => {
    expect(haversineKm(MASMAK, DIRIYAH)).toBeCloseTo(haversineKm(DIRIYAH, MASMAK), 10);
  });
});

describe("monthFromIsoDate / isHotMonth", () => {
  it("reads the month out of a YYYY-MM-DD date", () => {
    expect(monthFromIsoDate("2026-08-10")).toBe(8);
    expect(monthFromIsoDate("2026-01-01")).toBe(1);
  });

  it("returns null rather than a wrong month for unparseable input", () => {
    expect(monthFromIsoDate("")).toBeNull();
    expect(monthFromIsoDate("10/08/2026")).toBeNull();
    expect(monthFromIsoDate("2026-13-01")).toBeNull();
  });

  it("treats June through September as hot", () => {
    expect([6, 7, 8, 9].every((m) => isHotMonth(m))).toBe(true);
    expect([1, 2, 3, 4, 5, 10, 11, 12].some((m) => isHotMonth(m))).toBe(false);
  });

  it("does not call an unknown month hot", () => {
    expect(isHotMonth(null)).toBe(false);
  });
});

describe("estimateLeg", () => {
  it("calls a short hop a walk, free and certain, outside the hot season", () => {
    const leg = estimateLeg(DIRIYAH, BUJAIRI, { hot: false });
    expect(leg.mode).toBe("walk");
    expect(leg.costSar).toBe(0);
    // A free walk over a real distance is the one leg with nothing to be
    // uncertain about — see the module's certainty split.
    expect(leg.uncertain).toBe(false);
    expect(leg.basis).toBe("computed");
  });

  it("still walks the very shortest hops in the hot season", () => {
    // Diriyah → Bujairi is ~250m; hot-season walking doesn't stop entirely.
    expect(estimateLeg(DIRIYAH, BUJAIRI, { hot: true }).mode).toBe("walk");
  });

  it("switches a mid-length walk to a ride in the hot season", () => {
    // Masmak → National Museum: ~0.9km street-corrected. Walkable in winter,
    // a bad recommendation in August.
    expect(estimateLeg(MASMAK, NAT_MUSEUM, { hot: false }).mode).toBe("walk");
    expect(estimateLeg(MASMAK, NAT_MUSEUM, { hot: true }).mode).toBe("ride_hail");
  });

  it("prices a long hop as a ride and keeps the fare flagged uncertain", () => {
    const leg = estimateLeg(MASMAK, DIRIYAH, { hot: false });
    expect(leg.mode).toBe("ride_hail");
    expect(leg.costSar).toBeGreaterThan(11);
    // The distance is exact; the fare is a constant-table guess, and the flag
    // tracks the fare. Don't relax this without sourcing the constants.
    expect(leg.uncertain).toBe(true);
  });

  it("never quotes below the ride-hail minimum fare", () => {
    // A hop just past the walking threshold would otherwise price under it.
    const leg = estimateLeg(MASMAK, NAT_MUSEUM, { hot: true });
    expect(leg.mode).toBe("ride_hail");
    expect(leg.costSar).toBeGreaterThanOrEqual(11);
  });

  it("applies the street-detour factor rather than reporting the straight line", () => {
    const leg = estimateLeg(MASMAK, DIRIYAH, { hot: false });
    expect(leg.distanceKm!).toBeGreaterThan(haversineKm(MASMAK, DIRIYAH));
  });

  it("gives every leg a positive duration", () => {
    for (const hot of [true, false]) {
      for (const [a, b] of [[DIRIYAH, BUJAIRI], [MASMAK, NAT_MUSEUM], [MASMAK, DIRIYAH]] as const) {
        expect(estimateLeg(a, b, { hot }).durationMinutes).toBeGreaterThan(0);
      }
    }
  });
});

describe("estimateDayTransport", () => {
  it("produces one leg fewer than there are stops", () => {
    const [day] = estimateDayTransport(
      [{ dayNumber: 1, stops: [MASMAK, NAT_MUSEUM, DIRIYAH] }],
      { hot: false },
    );
    expect(day.legs).toHaveLength(2);
    expect(day.complete).toBe(true);
  });

  it("counts a single-stop day as complete with no legs", () => {
    const [day] = estimateDayTransport([{ dayNumber: 1, stops: [MASMAK] }], { hot: false });
    expect(day.legs).toEqual([]);
    expect(day.complete).toBe(true);
  });

  it("counts an empty day as complete", () => {
    const [day] = estimateDayTransport([{ dayNumber: 1, stops: [] }], { hot: false });
    expect(day.complete).toBe(true);
  });

  it("flags a day incomplete when a stop has no coordinates, keeping what it could compute", () => {
    const [day] = estimateDayTransport(
      [{ dayNumber: 1, stops: [MASMAK, NAT_MUSEUM, { name: "Some restaurant" }] }],
      { hot: false },
    );
    // Masmak → Museum computes; Museum → restaurant can't.
    expect(day.legs).toHaveLength(1);
    expect(day.complete).toBe(false);
  });

  it("chains legs end to end so the route reads continuously", () => {
    const [day] = estimateDayTransport(
      [{ dayNumber: 1, stops: [MASMAK, NAT_MUSEUM, DIRIYAH] }],
      { hot: false },
    );
    expect(day.legs[0].to).toBe(day.legs[1].from);
  });
});
