import { describe, it, expect } from "vitest";
import { normaliseAllergens } from "./allergens";

/**
 * normaliseAllergens repairs a real safety bug: two screens wrote allergies in
 * two different shapes (`"nuts"` vs `"ob.allergy.nuts"`), and Live Lens only
 * matched one, so onboarding-set allergies produced NO warnings. These tests
 * pin that BOTH shapes normalise to the same canonical token — a regression
 * here silently drops allergy warnings, which is why it's tested at all.
 */
describe("normaliseAllergens", () => {
  it("passes canonical bare tokens through", () => {
    expect(normaliseAllergens(["nuts", "dairy"])).toEqual(["nuts", "dairy"]);
  });

  it("repairs legacy ob.allergy.* keys to bare tokens", () => {
    expect(normaliseAllergens(["ob.allergy.nuts", "ob.allergy.shellfish"]))
      .toEqual(["nuts", "shellfish"]);
  });

  it("accepts a mix of both shapes", () => {
    expect(normaliseAllergens(["nuts", "ob.allergy.dairy"])).toEqual(["nuts", "dairy"]);
  });

  it("de-duplicates when both shapes name the same allergen", () => {
    expect(normaliseAllergens(["nuts", "ob.allergy.nuts"])).toEqual(["nuts"]);
  });

  it("drops unknown entries rather than passing them through", () => {
    // An unrecognised value can never match a dish, so keeping it would only
    // make the list look longer than it is.
    expect(normaliseAllergens(["nuts", "peanuts", "ob.allergy.bogus"])).toEqual(["nuts"]);
  });

  it("ignores non-string entries", () => {
    expect(normaliseAllergens(["nuts", 42, null, { x: 1 }] as unknown[])).toEqual(["nuts"]);
  });

  it("returns an empty list for non-array input", () => {
    expect(normaliseAllergens(undefined)).toEqual([]);
    expect(normaliseAllergens(null)).toEqual([]);
    expect(normaliseAllergens("nuts")).toEqual([]);
  });
});
