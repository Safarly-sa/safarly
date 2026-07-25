/**
 * Deterministic intracity transport estimates, computed from POI coordinates.
 *
 * Every POI in the curated dataset carries a real lat/lng, so the distance
 * between two consecutive stops is a computation, not a judgement call. Before
 * this module existed the Transportation agent was handed a list of stop
 * *names* and its own prompt told it:
 *
 *   "You do not know the exact distance between two specific named places, so
 *    set uncertain true on every leg"
 *
 * — a self-inflicted limitation, since the coordinates were sitting unused in
 * the client the whole time (they were only ever passed to Leaflet to drop map
 * markers). Distance, and the mode and duration that follow from it, are now
 * derived here; the model's remaining job is the contextual `notes` it is
 * genuinely better at than arithmetic.
 *
 * WHAT IS AND ISN'T CERTAIN HERE — this split is load-bearing, don't collapse it:
 *   - Distance is exact (within the straight-line correction below).
 *   - Mode and duration follow from distance and are as good as that.
 *   - Fares are NOT computed knowledge. See the RIDE_HAIL_* note.
 * So `uncertain` continues to mean "don't read these numbers as a quote", and
 * stays true on every leg whose cost is a guess, however exact its distance is.
 */
import type { TransportLeg, TripStop } from "./trip-types";

export interface Coordinates {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;

const toRadians = (deg: number): number => (deg * Math.PI) / 180;

/** Great-circle distance in kilometres. */
export function haversineKm(a: Coordinates, b: Coordinates): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/**
 * Haversine gives a straight line; streets don't. 1.3 is the conventional
 * urban detour factor — applied so a 1.0 km straight-line hop isn't quoted as
 * a 13-minute walk that turns out to be 18 on the actual pavement.
 */
const STREET_DETOUR_FACTOR = 1.3;

/**
 * Ride-hail fare model (Uber/Careem-style), in SAR.
 *
 * UNVERIFIED. These are order-of-magnitude figures chosen to be plausible for
 * Saudi cities, NOT a published tariff — no live pricing source was consulted
 * when they were written, and fares vary by city, time of day, and surge. They
 * exist so that every leg carries a number even with no API key configured,
 * which is what makes the deterministic path a genuine fallback rather than a
 * blank. Every ride-hail leg is marked `uncertain: true` because of this,
 * regardless of how exact its distance is. Replace with sourced figures — and
 * only then consider relaxing that flag — before anyone treats these as prices.
 */
const RIDE_HAIL_BASE_SAR = 6;
const RIDE_HAIL_PER_KM_SAR = 1.8;
const RIDE_HAIL_MINIMUM_SAR = 11;

const WALK_SPEED_KMH = 4.5;
/** Urban average across lights and traffic, not free-flow road speed. */
const DRIVE_SPEED_KMH = 26;
/** Typical wait for a pickup, added to every driven leg. */
const PICKUP_WAIT_MINUTES = 6;

/**
 * How far someone will actually walk between two stops.
 *
 * The hot-month threshold is not a rounding-down of the normal one: Jun-Sep
 * daytime highs across most of the Kingdom make an 800 m walk a genuinely bad
 * recommendation, not merely a warm one. Suggesting it would be the kind of
 * advice that reads fine on a screen in a temperate country and is wrong on
 * the ground, which is exactly what a Saudi-focused travel app should not do.
 */
const WALK_MAX_KM = 1.2;
const WALK_MAX_KM_HOT = 0.5;

/** Jun, Jul, Aug, Sep — 1-indexed to match a YYYY-MM-DD slice. */
const HOT_MONTHS = new Set([6, 7, 8, 9]);

/** Month as 1-12 from a YYYY-MM-DD date, or null if unparseable. */
export function monthFromIsoDate(date: string): number | null {
  const match = /^\d{4}-(\d{2})-\d{2}/.exec(date);
  if (!match) return null;
  const month = Number(match[1]);
  return month >= 1 && month <= 12 ? month : null;
}

export function isHotMonth(month: number | null): boolean {
  return month !== null && HOT_MONTHS.has(month);
}

function hasCoordinates(stop: TripStop): stop is TripStop & Coordinates {
  return typeof stop.lat === "number" && typeof stop.lng === "number";
}

/**
 * One hop between two stops that both have coordinates.
 *
 * Walking legs come back `uncertain: false` — a zero fare is not an estimate,
 * and the duration derives from a real distance. Driven legs stay uncertain
 * because their cost does.
 */
export function estimateLeg(
  from: TripStop & Coordinates,
  to: TripStop & Coordinates,
  options: { hot: boolean },
): TransportLeg {
  const straightLineKm = haversineKm(from, to);
  const distanceKm = straightLineKm * STREET_DETOUR_FACTOR;
  const walkLimit = options.hot ? WALK_MAX_KM_HOT : WALK_MAX_KM;

  const rounded = Math.round(distanceKm * 10) / 10;

  if (distanceKm <= walkLimit) {
    return {
      from: from.name,
      to: to.name,
      mode: "walk",
      durationMinutes: Math.max(1, Math.round((distanceKm / WALK_SPEED_KMH) * 60)),
      costSar: 0,
      distanceKm: rounded,
      basis: "computed",
      uncertain: false,
    };
  }

  const fare = Math.max(
    RIDE_HAIL_MINIMUM_SAR,
    RIDE_HAIL_BASE_SAR + distanceKm * RIDE_HAIL_PER_KM_SAR,
  );

  return {
    from: from.name,
    to: to.name,
    mode: "ride_hail",
    durationMinutes: Math.round((distanceKm / DRIVE_SPEED_KMH) * 60) + PICKUP_WAIT_MINUTES,
    costSar: Math.round(fare),
    distanceKm: rounded,
    basis: "computed",
    uncertain: true,
  };
}

export interface EstimatedDay {
  dayNumber: number;
  legs: TransportLeg[];
  /**
   * True when every consecutive pair on this day could be computed. A day with
   * a coordinate-less stop in the middle yields the legs it could compute and
   * sets this false, so the caller can decide whether to fall back to the model
   * for the whole trip rather than silently shipping a day with holes in it.
   */
  complete: boolean;
}

/**
 * Computes each day's hops. Days with fewer than two stops legitimately have
 * no legs and count as complete — there is nothing to travel between.
 */
export function estimateDayTransport(
  days: { dayNumber: number; stops: TripStop[] }[],
  options: { hot: boolean },
): EstimatedDay[] {
  return days.map((day) => {
    const legs: TransportLeg[] = [];
    let complete = true;

    for (let i = 0; i < day.stops.length - 1; i++) {
      const from = day.stops[i];
      const to = day.stops[i + 1];
      if (hasCoordinates(from) && hasCoordinates(to)) {
        legs.push(estimateLeg(from, to, options));
      } else {
        complete = false;
      }
    }

    return { dayNumber: day.dayNumber, legs, complete };
  });
}
