import { describe, it, expect } from "vitest";
import { validateRequest } from "./trip-validate";

/**
 * The trip-generate validator is what keeps an untrusted body from reaching the
 * three agents. It also bounds the request — a caller sending a 10,000-stop day
 * shouldn't be able to blow up the enrichment call — so the caps are tested too.
 */
describe("validateRequest (trip/generate)", () => {
  const ok = {
    cityDisplayName: "Riyadh", dateStart: "2026-08-10", dateEnd: "2026-08-13",
    budgetSarPerDay: 600, travelType: "couple", languageName: "English",
    days: [{ dayNumber: 1, stopNames: ["Masmak"] }], poiAreas: ["Olaya"],
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
    const many = Array.from({ length: 100 }, (_, i) => ({ dayNumber: i, stopNames: [] }));
    expect(validateRequest({ ...ok, days: many })!.days.length).toBeLessThanOrEqual(30);
  });

  it("caps stop names per day", () => {
    const bigDay = [{ dayNumber: 1, stopNames: Array.from({ length: 100 }, (_, i) => `s${i}`) }];
    expect(validateRequest({ ...ok, days: bigDay })!.days[0].stopNames.length).toBeLessThanOrEqual(20);
  });
});
