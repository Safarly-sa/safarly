import { describe, it, expect } from "vitest";
import { resolve, poiName, poiCulture } from "./poi-i18n";

/**
 * The `t()` used across the app ECHOES the key back when a translation is
 * missing. The old idiom `t(key) || fallback` therefore never fell back (a
 * non-empty key string is truthy), so a POI without a translation rendered the
 * literal "poi.some_id.name". These helpers compare against the key instead;
 * the tests pin that the echo is treated as "missing" and the fallback fires —
 * which is exactly what makes the newly-added POIs show their English name
 * rather than a raw key in the nine locales that don't translate them.
 */

/** A `t` that has some keys and echoes the rest, mimicking the real i18n layer. */
const t = (dict: Record<string, string>) => (key: string) => dict[key] ?? key;

describe("resolve", () => {
  it("returns the translation when one exists", () => {
    expect(resolve(t({ "poi.x.name": "Fortress" }), "poi.x.name", "Fallback")).toBe("Fortress");
  });

  it("falls back when the translation is missing (key echoed)", () => {
    expect(resolve(t({}), "poi.x.name", "Fallback")).toBe("Fallback");
  });
});

describe("poiName", () => {
  it("uses the translated name when present", () => {
    const poi = { id: "masmak", name: "Al-Masmak Fortress" };
    expect(poiName(t({ "poi.masmak.name": "قلعة المصمك" }), poi)).toBe("قلعة المصمك");
  });

  it("falls back to the data name when the locale lacks the key", () => {
    const poi = { id: "newpoi", name: "Riyadh Zoo" };
    expect(poiName(t({}), poi)).toBe("Riyadh Zoo"); // never "poi.newpoi.name"
  });
});

describe("poiCulture", () => {
  it("returns undefined when the POI has no culture note at all", () => {
    expect(poiCulture(t({}), { id: "x" })).toBeUndefined();
  });

  it("falls back to the raw note when the locale lacks the key", () => {
    const poi = { id: "x", culture_note: "An 18th-century citadel." };
    expect(poiCulture(t({}), poi)).toBe("An 18th-century citadel.");
  });

  it("prefers the translated note when present", () => {
    const poi = { id: "x", culture_note: "An 18th-century citadel." };
    expect(poiCulture(t({ "poi.x.culture": "قلعة من القرن الثامن عشر." }), poi))
      .toBe("قلعة من القرن الثامن عشر.");
  });
});
