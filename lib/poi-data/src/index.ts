import raw from "./pois.json";

/**
 * The curated points of interest the itinerary engine builds trips from.
 *
 * This lives in its own package because both sides need it and neither owns
 * it: the frontend engine schedules against it, and the API validates
 * submitted POI ids against it. Before this package existed the file sat
 * under `artifacts/safarly/src/data/`, which the API server could not reach
 * across the workspace boundary — so it accepted any string as a POI id and
 * had no way to tell a real place from an invented one.
 *
 * Still the live dataset, and still the one to edit. `docs/research-data/`
 * remains a separate corpus that is not loaded at runtime — see its README
 * before merging anything out of it.
 */
export interface Poi {
  id: string;
  name: string;
  city: string;
  category: string;
  lat: number;
  lng: number;
  price_range: number;
  duration_hrs: number;
  hidden_gem: boolean;
  family_friendly: boolean;
  accessible: boolean;
  indoor: boolean;
  best_slot: string;
  map_url: string;
  culture_note?: string;
  /**
   * Whether this entry's coordinates and entry price come from the researched
   * dataset (true) or were authored to fill out the pool (false).
   *
   * Authored entries are real, well-known places, but their lat/lng is
   * approximate and their price is an estimate — so they must not carry the
   * "Verified" badge. Absent is treated as verified: the original 50 rows
   * predate this field.
   */
  verified?: boolean;
}

export const pois: Poi[] = raw as Poi[];

/** Membership test for "is this a real place?" — the API's guard against invented ids. */
export const POI_IDS: ReadonlySet<string> = new Set(pois.map((p) => p.id));

export function isKnownPoiId(id: string): boolean {
  return POI_IDS.has(id);
}
