/**
 * Localised dish and meal-venue text.
 *
 * Dish names/descriptions live in the locale files under `dish.<id>.name`
 * and `dish.<id>.desc`, mirroring `poi-i18n.ts`'s `poi.<id>.*` convention —
 * same reasoning applies: `t()` echoes the key back when a translation is
 * missing, so callers must compare against the key rather than relying on
 * `||`, which is never falsy for a non-empty echoed key.
 *
 * Venue/area (restaurant + neighbourhood) aren't UI chrome translated per
 * locale file — they're per-(dish, city) data from `meal-venues.json`,
 * stored bilingually (EN + AR) the same way `dish.name`/`dish.name_ar` are.
 */

import type { ItineraryMeal } from "./engine";
import { resolve } from "./poi-i18n";

type Translate = (key: string) => string;

export function dishName(t: Translate, dish: { id: string; name: string }): string {
  return resolve(t, `dish.${dish.id}.name`, dish.name);
}

export function dishDesc(t: Translate, dish: { id: string; description: string }): string {
  return resolve(t, `dish.${dish.id}.desc`, dish.description);
}

/** Undefined only when meal-venues.json has no entry for this dish+city. */
export function mealVenue(meal: ItineraryMeal, language: string): string | undefined {
  if (!meal.venue) return undefined;
  return language === "ar" && meal.venueAr ? meal.venueAr : meal.venue;
}

export function mealArea(meal: ItineraryMeal, language: string): string | undefined {
  if (!meal.area) return undefined;
  return language === "ar" && meal.areaAr ? meal.areaAr : meal.area;
}
