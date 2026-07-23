import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

/**
 * Locale drift guard.
 *
 * `t()` echoes the key back when a translation is missing, so a locale that
 * falls behind `en` doesn't crash — it silently shows English (or a raw key) to
 * that language's users. That failure is invisible in the running app, which is
 * exactly why it needs a test. English is the source of truth; every other
 * locale must carry the same keyset, no more and no less.
 *
 * `ar` is allowed EXTRA keys: it alone holds `poi.<id>.name` Arabic names that
 * the other locales fall back to English for by design. So ar is checked for
 * completeness (no missing keys) but not for extra ones.
 */
const dir = path.dirname(fileURLToPath(import.meta.url));

function load(file: string): Record<string, string> {
  return JSON.parse(readFileSync(path.join(dir, file), "utf8"));
}

const en = load("en.json");
const enKeys = new Set(Object.keys(en));
const localeFiles = readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "en.json");

describe("locale parity", () => {
  it("finds all the locale files", () => {
    // If the app gains a locale, it should be caught here, not shipped half-translated.
    expect(localeFiles.length).toBeGreaterThanOrEqual(10);
  });

  for (const file of localeFiles) {
    const locale = load(file);
    const localeKeys = new Set(Object.keys(locale));
    const isArabic = file === "ar.json";

    it(`${file} has every key en has`, () => {
      const missing = [...enKeys].filter((k) => !localeKeys.has(k));
      expect(missing, `${file} is missing: ${missing.join(", ")}`).toEqual([]);
    });

    it(`${file} has no keys en lacks${isArabic ? " (beyond POI names)" : ""}`, () => {
      const extra = [...localeKeys].filter((k) => !enKeys.has(k));
      // ar carries Arabic POI names on top of the shared keyset — those are expected.
      const unexpected = isArabic ? extra.filter((k) => !k.startsWith("poi.")) : extra;
      expect(unexpected, `${file} has unexpected: ${unexpected.join(", ")}`).toEqual([]);
    });

    it(`${file} has no empty values`, () => {
      const blank = Object.entries(locale).filter(([, v]) => typeof v !== "string" || !v.trim()).map(([k]) => k);
      expect(blank, `${file} has blank values: ${blank.join(", ")}`).toEqual([]);
    });
  }
});
