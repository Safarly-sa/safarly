/**
 * Arabic strings for the POI spike, read straight out of the app's own locale
 * file rather than re-typed here.
 *
 * `ar.json` is a flat map of dotted keys ("poi.ruh_masmak.name"), not a nested
 * object — worth knowing before you reach for `ar.poi[id].name` and get
 * `undefined` for all 114 rows.
 *
 * Three key families matter:
 *
 *   poi.<id>.name       Arabic POI name      — partial coverage, see below
 *   poi.<id>.culture    Arabic culture note  — partial coverage
 *   trip.city.<city>.title   Arabic city name    — complete
 *   itin.cat.<category>      Arabic category     — complete
 *
 * Coverage is the thing to check before reading any Arabic eval result.
 * As of writing: 42/114 POIs have an Arabic name and 21/114 an Arabic culture
 * note. The 16-city expansion added POIs without Arabic names, so twelve cities
 * are at zero. That is a *data* gap, not a retrieval failure, and conflating the
 * two would make the model look broken. `arabicCoverage()` exists so the eval
 * can report it up front.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { pois } from "@workspace/poi-data";

const AR_PATH = fileURLToPath(
  new URL("../../../artifacts/safarly/src/locales/ar.json", import.meta.url),
);

const ar: Record<string, string> = JSON.parse(readFileSync(AR_PATH, "utf8"));

/** Arabic POI name, or undefined when this POI was never translated. */
export function arabicName(poiId: string): string | undefined {
  return ar[`poi.${poiId}.name`];
}

/** Arabic culture note, or undefined. Rarer than the name. */
export function arabicCulture(poiId: string): string | undefined {
  return ar[`poi.${poiId}.culture`];
}

/**
 * Arabic city name. Complete for every city in the dataset — falls back to the
 * raw key rather than throwing, matching how `t()` behaves in the app.
 */
export function arabicCity(cityKey: string): string {
  return ar[`trip.city.${cityKey}.title`] ?? cityKey;
}

/** Arabic category label. Complete for all 9 categories the dataset uses. */
export function arabicCategory(category: string): string {
  return ar[`itin.cat.${category}`] ?? category;
}

export type ArabicCoverage = {
  total: number;
  withName: number;
  withCulture: number;
  /** City key → how many of its POIs lack an Arabic name. */
  missingNameByCity: Record<string, number>;
};

export function arabicCoverage(): ArabicCoverage {
  const missingNameByCity: Record<string, number> = {};
  let withName = 0;
  let withCulture = 0;

  for (const poi of pois) {
    if (arabicName(poi.id)) withName += 1;
    else missingNameByCity[poi.city] = (missingNameByCity[poi.city] ?? 0) + 1;
    if (arabicCulture(poi.id)) withCulture += 1;
  }

  return { total: pois.length, withName, withCulture, missingNameByCity };
}

export function formatCoverage(c: ArabicCoverage): string {
  const missing = Object.entries(c.missingNameByCity)
    .sort((a, b) => b[1] - a[1])
    .map(([city, n]) => `${city}:${n}`)
    .join(" ");
  return (
    `Arabic coverage: names ${c.withName}/${c.total}, ` +
    `culture notes ${c.withCulture}/${c.total}\n` +
    (missing ? `  missing names by city — ${missing}\n` : "")
  );
}
