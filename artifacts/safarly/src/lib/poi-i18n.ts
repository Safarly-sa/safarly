/**
 * Localised POI text.
 *
 * POI names and culture notes live in the locale files under `poi.<id>.name`
 * and `poi.<id>.culture`, while the raw English sits in `@workspace/poi-data`.
 *
 * Call sites used to write `t("poi." + poi.id + ".name") || poi.name`, which
 * never actually falls back: `t()` echoes the key back when a translation is
 * missing, and a non-empty key string is truthy. That worked only because every
 * POI happens to have a name key today — the moment someone adds a POI without
 * one, the UI would render the literal string "poi.some_id.name". These helpers
 * compare against the key so the fallback behaves as intended.
 */

type Translate = (key: string) => string;

export function resolve(t: Translate, key: string, fallback: string): string {
  const value = t(key);
  return value === key ? fallback : value;
}

export function poiName(t: Translate, poi: { id: string; name: string }): string {
  return resolve(t, `poi.${poi.id}.name`, poi.name);
}

/** Returns undefined when the POI has no culture note at all. */
export function poiCulture(
  t: Translate,
  poi: { id: string; culture_note?: string },
): string | undefined {
  if (!poi.culture_note) return undefined;
  return resolve(t, `poi.${poi.id}.culture`, poi.culture_note);
}
