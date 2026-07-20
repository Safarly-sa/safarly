/**
 * Split out from generate.ts so this has zero dependency on Express/session/DB
 * machinery — pure input validation should be importable (and testable) on its
 * own, not dragged behind whatever the route module happens to also import.
 */
import type { TripGenerateRequest } from "./trip-types";

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
      stopNames: Array.isArray(d?.stopNames) ? d.stopNames.slice(0, 20).map(String) : [],
    })),
    poiAreas: b.poiAreas.slice(0, 20).map(String),
  };
}
