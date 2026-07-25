import { describe, it, expect } from "vitest";
import { runTransportAgent } from "./transport-agent";
import { validateRequest } from "./trip-validate";
import type { TripGenerateRequest } from "./trip-types";

/**
 * Covers the demo path only — it needs no key, no network, and no Express, and
 * it is what every developer without a GEMINI_API_KEY actually sees.
 *
 * It's also the path that changed most: demo transport used to be a flat
 * "15 min / 20 SAR" for every hop regardless of whether the two stops were
 * 200m or 20km apart, which made the enrichment UI impossible to judge while
 * building against it. These assertions exist to stop it regressing to that.
 */
const base = {
  cityDisplayName: "Riyadh",
  dateStart: "2026-01-10",
  dateEnd: "2026-01-12",
  budgetSarPerDay: 600,
  travelType: "couple",
  languageName: "English",
  poiAreas: ["Olaya"],
};

const MASMAK = { name: "Al-Masmak Fortress", lat: 24.6883, lng: 46.7146 };
const DIRIYAH = { name: "Diriyah At-Turaif", lat: 24.7341, lng: 46.5751 };
const BUJAIRI = { name: "Al-Bujairi Heritage Park", lat: 24.7363, lng: 46.5758 };

const withDays = (days: TripGenerateRequest["days"]): TripGenerateRequest =>
  ({ ...base, days } as TripGenerateRequest);

describe("runTransportAgent (demo)", () => {
  it("computes distinct legs from coordinates rather than one flat fixture", async () => {
    const result = await runTransportAgent(
      withDays([{ dayNumber: 1, stops: [DIRIYAH, BUJAIRI, MASMAK] }]),
      true,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const [short, long] = result.data.dayTransport[0].legs;
    expect(short.mode).toBe("walk");
    expect(long.mode).toBe("ride_hail");
    // The regression this guards: both legs having identical numbers.
    expect(short.durationMinutes).not.toBe(long.durationMinutes);
    expect(short.distanceKm).toBeLessThan(long.distanceKm!);
    expect(short.basis).toBe("computed");
  });

  it("re-routes walkable hops to a ride when the trip falls in the hot season", async () => {
    const days = [{ dayNumber: 1, stops: [MASMAK, { name: "National Museum", lat: 24.691, lng: 46.708 }] }];

    const winter = await runTransportAgent(withDays(days), true);
    const summer = await runTransportAgent(
      { ...withDays(days), dateStart: "2026-07-10", dateEnd: "2026-07-12" },
      true,
    );

    expect(winter.ok && winter.data.dayTransport[0].legs[0].mode).toBe("walk");
    expect(summer.ok && summer.data.dayTransport[0].legs[0].mode).toBe("ride_hail");
  });

  it("falls back to model-shaped legs when stops arrive without coordinates", async () => {
    const result = await runTransportAgent(
      withDays([{ dayNumber: 1, stops: [{ name: "Somewhere" }, { name: "Elsewhere" }] }]),
      true,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const leg = result.data.dayTransport[0].legs[0];
    expect(leg.basis).toBe("model");
    expect(leg.distanceKm).toBeUndefined();
    expect(leg.uncertain).toBe(true);
  });

  it("survives the request actually produced by the validator", async () => {
    // Guards the seam between the two: a shape change on either side that the
    // types alone wouldn't catch shows up here as empty legs.
    const parsed = validateRequest({
      ...base,
      days: [{ dayNumber: 1, stops: [MASMAK, DIRIYAH] }],
    });

    expect(parsed).not.toBeNull();
    const result = await runTransportAgent(parsed!, true);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.dayTransport[0].legs).toHaveLength(1);
    expect(result.data.dayTransport[0].legs[0].distanceKm).toBeGreaterThan(0);
  });
});
