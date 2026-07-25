/**
 * Split out from generate.ts so this has zero dependency on Express/session/DB
 * machinery — pure input validation should be importable (and testable) on its
 * own, not dragged behind whatever the route module happens to also import.
 */
import type { TripGenerateRequest, TripStop } from "./trip-types";

/**
 * Coordinates are only carried through when they're real numbers in range —
 * a NaN or an out-of-range latitude would otherwise reach the haversine in
 * transport-estimate.ts and come back as a plausible-looking distance built
 * from nonsense. Dropping the pair degrades that stop to the model path,
 * which is the correct failure mode.
 */
function toStop(raw: unknown): TripStop {
  const s = raw as { name?: unknown; lat?: unknown; lng?: unknown } | null;
  const name = typeof s?.name === "string" ? s.name.slice(0, 120) : String(s ?? "");
  const lat = s?.lat;
  const lng = s?.lng;

  const usable =
    typeof lat === "number" && Number.isFinite(lat) && Math.abs(lat) <= 90 &&
    typeof lng === "number" && Number.isFinite(lng) && Math.abs(lng) <= 180;

  return usable ? { name, lat: lat as number, lng: lng as number } : { name };
}

export function validateRequest(body: unknown): TripGenerateRequest | null {
  const b = body as Partial<TripGenerateRequest> | null;
  if (!b || typeof b !== "object") return null;
  if (typeof b.cityDisplayName !== "string" || !b.cityDisplayName.trim()) return null;
  if (typeof b.dateStart !== "string" || typeof b.dateEnd !== "string") return null;
  if (typeof b.budgetSarPerDay !== "number") return null;
  if (typeof b.travelType !== "string") return null;
  if (!Array.isArray(b.days)) return null;
  if (!Array.isArray(b.poiAreas)) return null;

  return {
    cityDisplayName: b.cityDisplayName.trim().slice(0, 80),
    cityDisplayNameAr: typeof b.cityDisplayNameAr === "string" ? b.cityDisplayNameAr.slice(0, 80) : undefined,
    dateStart: b.dateStart,
    dateEnd: b.dateEnd,
    budgetSarPerDay: b.budgetSarPerDay,
    travelType: b.travelType.slice(0, 40),
    languageName: typeof b.languageName === "string" && b.languageName.trim() ? b.languageName.trim().slice(0, 40) : "English",
    // Cap array/string sizes — this is JSON, not an upload, but nothing stops
    // a caller sending a 10,000-stop day; keep the enrichment call bounded.
    days: b.days.slice(0, 30).map((d) => ({
      dayNumber: typeof d?.dayNumber === "number" ? d.dayNumber : 0,
      stops: Array.isArray(d?.stops) ? d.stops.slice(0, 20).map(toStop) : [],
    })),
    poiAreas: b.poiAreas.slice(0, 20).map(String),
  };
}
