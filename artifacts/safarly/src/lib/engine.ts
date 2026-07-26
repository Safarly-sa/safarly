/**
 * Safarly Itinerary Engine
 * Generates a day-by-day itinerary from traveller profile + trip spec.
 */

import { pois as poisData, type Poi } from "@workspace/poi-data";
import dishesData from "../data/dishes.json";
import mealVenuesData from "../data/meal-venues.json";

/* ── Domain Types ───────────────────────────────────────────────────── */

export interface TravelerProfile {
  nationality: string;
  language: string;
  ageRange: string;
  dietary: string;
  allergies: string[];
  travelType: string;   // "solo_woman" | "solo_man" | "couple" | "family" | "friends"
  accessibility: boolean;
  accessibilityNotes?: string;  // free-text specifics, e.g. "wheelchair access"; only set when accessibility is true
  interests: string[];  // "history" | "food" | "adventure" | "shopping" | "arts" | "nature" | "photography"
}

export interface TripSpec {
  city: string;           // "riyadh" | "jeddah" | "alula" | "al_khobar" | "abha" | "taif" | "madinah" | "ai"
  dateStart: string;      // "YYYY-MM-DD"
  dateEnd: string;
  budget: number;         // SAR per day
  moods: string[];        // "relax" | "adventure" | "romantic" | "luxury" | "spiritual" | "family" | "photography" | "food"
  goals?: string[];       // multi-select (up to 3), replaces goal
  goal?: string;          // legacy single-select (backward compat)
  customGoal?: string;
  travelContext?: string; // "solo_woman" | "solo_man" | "couple" | "family" | "friends"
}

export interface Objectives {
  culture: number;
  budget: number;
  hiddenGems: number;
  food: number;
  family: number;
  photography: number;
}

/**
 * The shape now lives with the data in `@workspace/poi-data`, so the API
 * server can validate submitted POI ids against the same source the engine
 * schedules from. Re-exported under the old name because plenty of pages
 * import `POI` from here.
 */
export type POI = Poi;

interface Dish {
  id: string;
  name: string;
  name_ar: string;
  meal_type: string;
  price_sar: number;
  common_allergens: string[];
  food_weight: number;
  description: string;
}

interface MealVenue {
  dish_id: string;
  city: string;
  venue: string;
  venue_ar: string;
  area: string;
  area_ar: string;
}

export interface ItineraryStop {
  slot: "morning" | "midday" | "afternoon" | "evening";
  startTime: string;
  endTime: string;
  poi: POI;
  prayerGapBefore: string | null;
}

export interface ItineraryMeal {
  type: "lunch" | "dinner";
  dish: Dish;
  estimatedTime: string;
  /**
   * Venue/area are absent (not empty strings) only when `meal-venues.json` has
   * no entry for this dish+city — the UI must render an explicit "coming soon"
   * line rather than silently dropping the restaurant recommendation.
   */
  venue?: string;
  venueAr?: string;
  area?: string;
  areaAr?: string;
  /** Google Maps search query built from venue + area + city — same pattern as POI.map_url. */
  mapUrl?: string;
}

/**
 * A single transport hop — either the one-time trip into the city (see
 * ItineraryResult.arrival) or one of a day's intracity hops between stops.
 * "uncertain" and costSar being an estimate (not a quote) are load-bearing:
 * this is model-generated guidance, not a booking, and the UI must not present
 * it as more certain than that.
 */
export interface TransportLeg {
  from: string;
  to: string;
  mode: "flight" | "train" | "bus" | "taxi" | "ride_hail" | "walk" | "car_rental";
  durationMinutes: number;
  costSar: number;
  notes?: string;
  uncertain: boolean;
  /**
   * Street-corrected distance between the two stops, computed server-side from
   * their real coordinates (transport-estimate.ts). Present on day legs, absent
   * on arrival legs and on any leg the model produced — nothing in the dataset
   * gives the model coordinates to work from.
   */
  distanceKm?: number;
  /**
   * "computed" — distance, mode, and duration were derived arithmetically from
   * coordinates, so they don't shift between runs. "model" — the whole leg is
   * an estimate. Absent means model.
   *
   * Note this does NOT make a computed leg's *fare* trustworthy: those come
   * from an unsourced constant table, which is why computed ride legs are
   * still `uncertain`. Read `basis` for the geometry, `uncertain` for the price.
   */
  basis?: "computed" | "model";
}

export interface ArrivalTransport {
  legs: TransportLeg[];
  summary: string;
}

/** A festival, exhibition, or seasonal event that may overlap the trip dates. */
export interface TripEvent {
  name: string;
  nameTranslated?: string;
  description: string;
  category: string;
  dateRange: string;
  venue?: string;
  overlapsTrip: boolean;
  /**
   * True whenever the model isn't confident this event is real/current for the
   * chosen dates — the model has no live calendar to check against, so this is
   * the load-bearing flag, not a nice-to-have. The UI must never render an
   * event as confirmed without checking it.
   */
  uncertain: boolean;
  sourceHint?: string;
}

/** Recommends an area + hotel type; never a specific bookable property. */
export interface AccommodationOption {
  area: string;
  areaTranslated?: string;
  whyThisArea: string;
  hotelType: string;
  nightlyCostSarLow: number;
  nightlyCostSarHigh: number;
  goodFor: string;
}

export interface ItineraryDay {
  date: string;
  dayNumber: number;
  stops: ItineraryStop[];
  meals: ItineraryMeal[];
  dailyCostSar: number;
  overBudget: boolean;
  prayerGaps: string[];
  /** Populated by the Transportation agent; absent until trip/generate's enrichment step runs. */
  transportLegs?: TransportLeg[];
}

export interface ItineraryResult {
  days: ItineraryDay[];
  objectives: Objectives;
  totalCostSar: number;
  verifiedCount: number;
  allergenSafeDishCount: number;
  candidateCount: number;
  hiddenGemShare: number;
  cultureNoteCount: number;
  cityName: string;
  resolvedCity: string;   // actual city key used (important when trip.city === "ai")
  budgetStatus: "ok" | "over";
  estimatedDailyAvg: number;
  /**
   * Everything below is populated by POST /api/trip/generate's enrichment
   * step (Events, Transportation, Accommodation agents), layered onto the
   * itinerary this engine already produced — never present on a freshly
   * client-generated result. All optional and absent, not empty arrays, until
   * that call has actually completed; render "not yet available" rather than
   * "confirmed none" when undefined.
   */
  events?: TripEvent[];
  arrival?: ArrivalTransport;
  accommodation?: AccommodationOption[];
}

/* ── City → POI dataset mapping ─────────────────────────────────────── */
// Every city now has its own researched POIs — see docs/notes/safarly-engine-cities.md
// for the incident that used to make this a fallback map (Abha borrowing AlUla's
// desert/archaeology data, mislabelled as "Abha" content). al_khobar is the one
// deliberate exception: it's a genuine Riyadh-adjacent modern city without its
// own dataset yet, kept as an honest documented fallback rather than removed.
const CITY_POI_MAP: Record<string, string> = {
  riyadh:         "riyadh",
  jeddah:         "jeddah",
  alula:          "alula",
  al_khobar:      "riyadh",  // Eastern Province — modern Saudi city, similar vibe; no dedicated dataset yet
  abha:           "abha",
  taif:           "taif",
  madinah:        "madinah",
  mecca:          "mecca",
  dammam:         "dammam",
  dhahran:        "dhahran",
  khamis_mushait: "khamis_mushait",
  jazan:          "jazan",
  najran:         "najran",
  tabuk:          "tabuk",
  hail:           "hail",
  yanbu:          "yanbu",
};

const CITY_NAMES: Record<string, string> = {
  riyadh:         "Riyadh",
  jeddah:         "Jeddah",
  alula:          "AlUla",
  al_khobar:      "Al Khobar",
  abha:           "Abha",
  taif:           "Taif",
  madinah:        "Madinah",
  mecca:          "Mecca",
  dammam:         "Dammam",
  dhahran:        "Dhahran",
  khamis_mushait: "Khamis Mushait",
  jazan:          "Jazan",
  najran:         "Najran",
  tabuk:          "Tabuk",
  hail:           "Hail",
  yanbu:          "Yanbu",
};

/**
 * Exported so every page needing an Arabic city display name (dashboard,
 * itinerary, generating) reads the same map instead of hand-copying it —
 * a hand-copied version of this once silently omitted 13 of 16 cities in
 * itinerary.tsx, falling back to the English name in Arabic mode.
 */
export const CITY_NAMES_EN: Record<string, string> = CITY_NAMES;
export const CITY_NAMES_AR: Record<string, string> = {
  riyadh:         "الرياض",
  jeddah:         "جدة",
  alula:          "العُلا",
  al_khobar:      "الخبر",
  abha:           "أبها",
  taif:           "الطائف",
  madinah:        "المدينة المنورة",
  mecca:          "مكة المكرمة",
  dammam:         "الدمام",
  dhahran:        "الظهران",
  khamis_mushait: "خميس مشيط",
  jazan:          "جازان",
  najran:         "نجران",
  tabuk:          "تبوك",
  hail:           "حائل",
  yanbu:          "ينبع",
};

/** Resolve "ai" city key to an actual city based on profile + trip context. */
function resolveAiCity(profile: TravelerProfile, trip: TripSpec): string {
  const moods     = trip.moods ?? [];
  const interests = profile.interests ?? [];
  const goals     = trip.goals ?? (trip.goal ? [trip.goal] : []);
  if (moods.includes("spiritual") || goals.includes("spiritual")) return "madinah";
  if (moods.includes("adventure") || interests.includes("adventure") || interests.includes("nature")) return "abha";
  if (interests.includes("history") || goals.includes("culture")) return "alula";
  if (moods.includes("food") || moods.includes("luxury") || moods.includes("romantic")) return "jeddah";
  if (moods.includes("family") || profile.travelType === "family" || trip.travelContext === "family") return "riyadh";
  return "riyadh";
}

/* ── Objective Mapping ──────────────────────────────────────────────── */

const GOAL_OBJECTIVES: Record<string, Partial<Objectives>> = {
  culture:   { culture: 0.90, hiddenGems: 0.30, food: 0.30, photography: 0.50, budget: 0.20, family: 0.20 },
  food:      { food: 0.90, hiddenGems: 0.40, culture: 0.30, photography: 0.30, budget: 0.30, family: 0.20 },
  gems:      { hiddenGems: 0.90, culture: 0.40, photography: 0.60, food: 0.30, budget: 0.30, family: 0.10 },
  family:    { family: 0.90, culture: 0.40, food: 0.50, budget: 0.50, photography: 0.30, hiddenGems: 0.20 },
  budget:    { budget: 0.90, hiddenGems: 0.50, food: 0.50, culture: 0.40, family: 0.30, photography: 0.20 },
  photo:     { photography: 0.90, hiddenGems: 0.50, culture: 0.40, food: 0.20, budget: 0.20, family: 0.20 },
  spiritual: { culture: 0.80, photography: 0.40, food: 0.20, hiddenGems: 0.30, budget: 0.30, family: 0.30 },
};

// Category → how strongly it satisfies each objective
const CATEGORY_RELEVANCE: Record<string, Partial<Objectives>> = {
  heritage:      { culture: 0.90, photography: 0.60 },
  museum:        { culture: 0.80, photography: 0.30 },
  nature:        { photography: 0.60, hiddenGems: 0.40 },
  religion:      { culture: 0.70, photography: 0.40 },
  shopping:      { food: 0.30, family: 0.40 },
  adventure:     { hiddenGems: 0.50, photography: 0.40 },
  art:           { photography: 0.70, culture: 0.50 },
  food:          { food: 0.80, hiddenGems: 0.30 },
  modern:        { photography: 0.50, family: 0.30 },
  entertainment: { family: 0.90, photography: 0.30 },
};

const PRAYER_GAPS = ["12:00", "15:30", "18:00"] as const;

const SLOT_START: Record<string, string> = {
  morning:   "08:00",
  midday:    "12:30",  // after Dhuhr prayer (12:00 + 15 min gap)
  afternoon: "15:45",  // after Asr prayer (15:30 + 15 min gap)
  evening:   "18:30",  // after Maghrib prayer (18:00 + 15 min gap + buffer)
};

const SLOTS = ["morning", "midday", "afternoon", "evening"] as const;

const PRAYER_GAP_BEFORE: Record<string, string | null> = {
  morning:   null,
  midday:    "12:00",
  afternoon: "15:30",
  evening:   "18:00",
};

/* ── Helpers ────────────────────────────────────────────────────────── */

function clamp(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + mins;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

function dist(a: POI, b: POI): number {
  return Math.sqrt((a.lat - b.lat) ** 2 + (a.lng - b.lng) ** 2);
}

/**
 * All orderings of `items`, shortest input first assumed. Only ever called on
 * a day's stops, which are capped at SLOTS.length (4) by construction in
 * buildDays below — worst case 24 permutations, trivial for a synchronous call.
 */
function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i++) {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)];
    for (const tail of permutations(rest)) out.push([items[i], ...tail]);
  }
  return out;
}

export interface DayOptimization {
  /**
   * Always a freshly built array with self-consistent slot/startTime/endTime,
   * even when `reordered` is false — use this, not the input, regardless of
   * the flag. A caller that only swaps in `.stops` when `reordered` is true
   * (as buildDays does) is still safe: on an input that was already
   * self-consistent, the rebuild reproduces it exactly, so skipping it there
   * changes nothing.
   */
  stops: ItineraryStop[];
  /** Whether the winning arrangement assigns any POI to a different slot than the input had it in — the signal for a "stops reordered" notice, not for whether anything in `.stops` changed. */
  reordered: boolean;
  /** Total travel-distance reduction, in the same degree-ish unit as dist(); 0 when not reordered. */
  distanceSaved: number;
}

/**
 * Finds the shortest-travel assignment of a day's already-selected stops to
 * their fixed time slots (morning/midday/afternoon/evening).
 *
 * This replaces two earlier, narrower pieces of logic that both computed the
 * same problem badly:
 *   - buildDays used to only ever try ONE candidate — swapping midday and
 *     afternoon — and applied it without checking that the stop landing in
 *     midday was actually indoor, which could reintroduce the exact
 *     heat-hours violation scorePoi's -500 exclusion exists to prevent.
 *   - the venue-closure demo in itinerary.tsx ran a nearest-neighbour pass
 *     over the stop ARRAY, but every stop kept its original slot/startTime,
 *     and the timeline always re-sorts by startTime for display — so that
 *     reorder had no visible effect. Its "N stops reordered" claim was cosmetic.
 *
 * Full permutation search (not a greedy heuristic) is what makes this an
 * actual optimum rather than a better guess, and it's affordable specifically
 * because a day is capped at 4 stops. Non-mutating: returns a new stops array,
 * leaves the input untouched.
 *
 * Deliberately canonicalises on each stop's OWN `.slot` field rather than
 * trusting array position to mean slot order. The obvious alternative —
 * document "pass this in slot order" as a precondition — is a footgun a
 * caller can violate silently: the venue-closure flow in itinerary.tsx builds
 * its replacement-stop array by filtering out the closed stop and APPENDING
 * the replacement at the end, which does not preserve slot order (a removed
 * midday stop's replacement lands at array index 3, not 1). Trusting position
 * there would check the wrong stop against the midday-indoor rule and could
 * silently let an outdoor replacement stand in the heat slot. Sorting by the
 * stop's own field first makes the function correct regardless of what order
 * the caller happened to hand stops in.
 *
 * The search only ever compares among VALID permutations — an input that
 * itself violates the midday rule is never treated as the baseline to beat,
 * so a violating arrangement that happens to already be geographically
 * shortest still gets corrected, not kept for "already being optimal".
 * `distanceSaved` can come out negative in that case: correctness cost some
 * distance, and that's reported honestly rather than clamped to 0.
 */
export function optimizeDayStops(stops: ItineraryStop[]): DayOptimization {
  if (stops.length < 2) return { stops, reordered: false, distanceSaved: 0 };

  const bySlot = [...stops].sort(
    (a, b) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot),
  );
  const slots = bySlot.map((s) => s.slot);
  const middayIndex = slots.indexOf("midday");

  const currentPois = bySlot.map((s) => s.poi);
  const totalDist = (order: POI[]): number => {
    let d = 0;
    for (let i = 0; i < order.length - 1; i++) d += dist(order[i], order[i + 1]);
    return d;
  };
  const violatesMiddayIndoor = (order: POI[]): boolean =>
    middayIndex !== -1 && !order[middayIndex].indoor;

  const currentDist = totalDist(currentPois);

  // bestOrder starts as `null`, NOT seeded from currentPois: if the given
  // arrangement itself violates the midday rule, it must never win purely
  // for being unbeaten on distance — permutations() is guaranteed to yield
  // the identity ordering first (see its own doc comment), so when the
  // input IS valid, it's still the first candidate tried and wins every
  // tie, which is what keeps a correct, already-shortest arrangement from
  // being churned for no reason.
  let bestOrder: POI[] | null = null;
  let bestDist = Infinity;

  for (const order of permutations(currentPois)) {
    if (violatesMiddayIndoor(order)) continue;
    const d = totalDist(order);
    if (d < bestDist) { bestDist = d; bestOrder = order; }
  }

  // No valid arrangement exists at all — e.g. none of today's stops are
  // indoor, which is reachable in practice: the venue-closure flow can swap
  // in an outdoor replacement without checking, leaving a day with zero
  // indoor stops to put in the heat slot. There's nothing better to offer,
  // but the input's time metadata can still be wrong (see below) — falling
  // back to the current geometry, not returning early, is what still gets
  // that fixed.
  if (!bestOrder) { bestOrder = currentPois; bestDist = currentDist; }

  // Rebuilt unconditionally, even when the assignment didn't change: a stop
  // handed in with a stale startTime/endTime (the venue-closure flow builds
  // its replacement stop by copying the CLOSED stop's time footprint, not
  // deriving one from the replacement's own duration_hrs) needs correcting
  // regardless of whether the geographic search found anything to improve.
  // `reordered` tracks only whether the POI-to-slot ASSIGNMENT changed —
  // that's the meaningful signal for a caller deciding whether to show a
  // "stops reordered" notice, not whether any object churned.
  const reordered = !bestOrder.every((poi, i) => poi === currentPois[i]);

  const newStops: ItineraryStop[] = bestOrder.map((poi, i) => {
    const slot = slots[i];
    const startTime = SLOT_START[slot];
    return {
      slot,
      startTime,
      endTime: addMinutes(startTime, Math.round(poi.duration_hrs * 60)),
      poi,
      prayerGapBefore: PRAYER_GAP_BEFORE[slot],
    };
  });

  return { stops: newStops, reordered, distanceSaved: reordered ? currentDist - bestDist : 0 };
}

/* ── Meal venue resolution ─────────────────────────────────────────────
 * dishes.json is shared across every city, so the venue/area a diner is
 * pointed to has to be resolved per (dish, poiCity) — see meal-venues.json,
 * audited to cover every dish for every dataset city. Real, named businesses
 * aren't available for every dish, so entries fall back to a descriptive
 * venue type grounded in a real neighbourhood (e.g. "Al-Balad, Jeddah")
 * rather than inventing a restaurant that doesn't exist.
 */
const MEAL_VENUE_MAP: Record<string, MealVenue> = {};
for (const v of mealVenuesData as MealVenue[]) {
  MEAL_VENUE_MAP[`${v.dish_id}|${v.city}`] = v;
}

function resolveMealVenue(dishId: string, poiCity: string): MealVenue | null {
  return MEAL_VENUE_MAP[`${dishId}|${poiCity}`] ?? null;
}

/** Same query-string pattern as every POI's map_url — venue + area + city stand in for coordinates we don't have. */
function buildMealMapUrl(venue: string, area: string, cityName: string): string {
  const query = `${venue}, ${area}, ${cityName}, Saudi Arabia`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function buildMeal(
  type: "lunch" | "dinner",
  dish: Dish | null,
  poiCity: string,
  cityName: string,
  estimatedTime: string,
): ItineraryMeal | null {
  if (!dish) return null;
  const mv = resolveMealVenue(dish.id, poiCity);
  return {
    type, dish, estimatedTime,
    venue: mv?.venue, venueAr: mv?.venue_ar,
    area: mv?.area, areaAr: mv?.area_ar,
    mapUrl: mv ? buildMealMapUrl(mv.venue, mv.area, cityName) : undefined,
  };
}

/* ── Objective Computation ──────────────────────────────────────────── */

function computeObjectives(profile: TravelerProfile, trip: TripSpec): Objectives {
  const base: Objectives = {
    culture: 0.30, budget: 0.30, hiddenGems: 0.30,
    food: 0.30, family: 0.30, photography: 0.30,
  };

  // Layer 1: goals (multi-select blend; backward-compat with single goal string)
  const goals = (trip.goals && trip.goals.length > 0)
    ? trip.goals
    : (trip.goal ? [trip.goal] : []);

  let o: Objectives = { ...base };
  if (goals.length > 0) {
    const keys = ["culture", "budget", "hiddenGems", "food", "family", "photography"] as const;
    const blended: Partial<Objectives> = {};
    for (const key of keys) {
      const sum = goals.reduce((acc, g) => acc + (GOAL_OBJECTIVES[g]?.[key] ?? base[key]), 0);
      blended[key] = sum / goals.length;
    }
    o = { ...base, ...blended };
  }

  // Layer 2: moods
  for (const mood of trip.moods ?? []) {
    switch (mood) {
      case "adventure":    o.hiddenGems = clamp(o.hiddenGems + 0.15); break;
      case "romantic":     o.hiddenGems = clamp(o.hiddenGems + 0.15); o.photography = clamp(o.photography + 0.10); break;
      case "luxury":       o.budget = clamp(o.budget - 0.30); o.photography = clamp(o.photography + 0.10); break;
      case "spiritual":    o.culture = clamp(o.culture + 0.10); break;
      case "family":       o.family = clamp(o.family + 0.20); break;
      case "photography":  o.photography = clamp(o.photography + 0.20); break;
      case "food":         o.food = clamp(o.food + 0.20); break;
      // "relax" only affects pacing, not objective weights
    }
  }

  // Layer 3: interests from profile
  for (const interest of (profile.interests ?? [])) {
    switch (interest) {
      case "history":      o.culture = clamp(o.culture + 0.15); break;
      case "food":         o.food = clamp(o.food + 0.15); break;
      case "adventure":    o.hiddenGems = clamp(o.hiddenGems + 0.10); break;
      case "arts":         o.culture = clamp(o.culture + 0.10); o.photography = clamp(o.photography + 0.10); break;
      case "nature":       o.hiddenGems = clamp(o.hiddenGems + 0.10); break;
      case "photography":  o.photography = clamp(o.photography + 0.15); break;
    }
  }

  // Layer 4: travel context (trip-level) + travel type (profile legacy)
  const travelContext = trip.travelContext ?? profile.travelType;
  if (travelContext === "family") {
    o.family = Math.max(o.family, 0.80);
  }

  return o;
}

/* ── POI Scoring ────────────────────────────────────────────────────── */

function scorePoi(
  poi: POI,
  objectives: Objectives,
  slot: string,
  needsFamily: boolean,
  needsAccessible: boolean,
): number {
  // Hard exclusions
  if (needsFamily && !poi.family_friendly) return -999;
  if (needsAccessible && !poi.accessible) return -999;

  // Midday must be indoor (heat hours 12:00–15:00)
  if (slot === "midday" && !poi.indoor) return -500;

  // Base score: category relevance × objective weights
  const relevance = CATEGORY_RELEVANCE[poi.category] ?? {};
  let score = 0;
  for (const [objKey, weight] of Object.entries(relevance)) {
    score += (weight as number) * objectives[objKey as keyof Objectives];
  }

  // Hidden gem bonus
  if (poi.hidden_gem) {
    score += 0.40 * objectives.hiddenGems;
  }

  // Slot preference bonus
  if (poi.best_slot === slot) score += 0.25;

  // Budget bonus: free POIs boost when budget objective is high
  if (objectives.budget > 0.60 && poi.price_range === 0) score += 0.20;
  if (objectives.budget > 0.60 && poi.price_range > 80) score -= 0.15;

  return score;
}

/* ── Day Building ───────────────────────────────────────────────────── */

function buildDays(
  cityPois: POI[],
  safeDishes: Dish[],
  objectives: Objectives,
  trip: TripSpec,
  profile: TravelerProfile,
  poiCity: string,
  cityName: string,
): ItineraryDay[] {
  const startDate = new Date(trip.dateStart + "T00:00:00");
  const endDate   = new Date(trip.dateEnd   + "T00:00:00");
  const numDays   = Math.max(1, Math.round(
    (endDate.getTime() - startDate.getTime()) / 86_400_000
  ) + 1);

  const needsFamily     = profile.travelType === "family";
  // A written note is a real signal on its own — treat it as equivalent to the
  // toggle so a note volunteered without the box being (re-)checked still counts.
  const needsAccessible = !!profile.accessibility || !!profile.accessibilityNotes?.trim();

  // Sorted dishes by food_weight (best first)
  const lunchDishes  = safeDishes.filter(d => d.meal_type === "lunch")
                                  .sort((a, b) => b.food_weight - a.food_weight);
  const dinnerDishes = safeDishes.filter(d => d.meal_type === "dinner")
                                  .sort((a, b) => b.food_weight - a.food_weight);

  const globalUsedPois = new Set<string>();
  const usedDishIds    = new Set<string>();

  function pickDish(pool: Dish[]): Dish | null {
    if (pool.length === 0) return null;
    const unused = pool.find(d => !usedDishIds.has(d.id));
    if (unused) { usedDishIds.add(unused.id); return unused; }
    // Cycle dishes if exhausted
    usedDishIds.clear();
    usedDishIds.add(pool[0].id);
    return pool[0];
  }

  const days: ItineraryDay[] = [];

  for (let d = 0; d < numDays; d++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + d);
    const dateStr = date.toISOString().split("T")[0];

    const dayUsed = new Set<string>();
    const dayStops: ItineraryStop[] = [];

    for (const slot of SLOTS) {
      // Available POIs: not already in this day
      let pool = cityPois.filter(p => !dayUsed.has(p.id));

      // Score each candidate
      const scored = pool
        .map(poi => ({ poi, score: scorePoi(poi, objectives, slot, needsFamily, needsAccessible) }))
        .filter(({ score }) => score > -100)
        .sort((a, b) => b.score - a.score);

      if (scored.length === 0) continue;

      // Prefer globally unseen; fall back to any
      const pick = scored.find(s => !globalUsedPois.has(s.poi.id)) ?? scored[0];

      globalUsedPois.add(pick.poi.id);
      dayUsed.add(pick.poi.id);

      const startTime = SLOT_START[slot];
      const endTime   = addMinutes(startTime, Math.round(pick.poi.duration_hrs * 60));

      dayStops.push({
        slot,
        startTime,
        endTime,
        poi: pick.poi,
        prayerGapBefore: PRAYER_GAP_BEFORE[slot],
      });
    }

    // Geographic reorder: find the shortest-travel assignment of today's stops
    // to their fixed time slots (full permutation search, not a single
    // candidate swap — see optimizeDayStops for why that used to be a bug).
    const optimizedDay = optimizeDayStops(dayStops);
    if (optimizedDay.reordered) {
      dayStops.length = 0;
      dayStops.push(...optimizedDay.stops);
    }

    // Meals
    const meals: ItineraryMeal[] = [];
    const lunch      = buildMeal("lunch",  pickDish(lunchDishes),  poiCity, cityName, "12:15");
    const dinner     = buildMeal("dinner", pickDish(dinnerDishes), poiCity, cityName, "19:30");
    if (lunch)  meals.push(lunch);
    if (dinner) meals.push(dinner);

    // Daily cost = POI entry fees + meals
    const stopsCost = dayStops.reduce((s, stop) => s + stop.poi.price_range, 0);
    const mealsCost = meals.reduce((s, m) => s + m.dish.price_sar, 0);
    const dailyCostSar = stopsCost + mealsCost;

    days.push({
      date: dateStr,
      dayNumber: d + 1,
      stops: dayStops,
      meals,
      dailyCostSar,
      overBudget: dailyCostSar > trip.budget,
      prayerGaps: [...PRAYER_GAPS],
    });
  }

  return days;
}

/**
 * A stop counts as verified only if its location is researched AND it has a
 * working map link. Both halves matter: an authored entry has an approximate
 * pin, and an entry with no map link can't be checked at all.
 *
 * `verified` absent means the row predates the flag, which only the original
 * researched set does — hence the `!== false` rather than a truthiness test.
 */
export function isVerified(poi: POI): boolean {
  return poi.verified !== false && !!poi.map_url;
}

/* ── Post-generation editing ────────────────────────────────────────── */
/**
 * Primitives for changing an itinerary AFTER the engine produced it — used by
 * the Concierge, which edits an existing trip rather than building a new one.
 *
 * These live here, not in the caller, because scheduling and cost are engine
 * rules. A stop added by the Concierge has to sit on the same slot clock and
 * count toward budget the same way as one the generator placed, or the two
 * halves of the itinerary quietly disagree about what a day costs.
 */

/** Places a POI in a slot using the generator's own slot clock and prayer gaps. */
export function scheduleStop(poi: POI, slot: ItineraryStop["slot"]): ItineraryStop {
  const startTime = SLOT_START[slot];
  return {
    slot,
    startTime,
    endTime: addMinutes(startTime, Math.round(poi.duration_hrs * 60)),
    poi,
    prayerGapBefore: PRAYER_GAP_BEFORE[slot],
  };
}

/** Re-derives a day's cost and budget flag from its current stops and meals. */
export function recalcDay(day: ItineraryDay, budgetPerDay: number): ItineraryDay {
  const stopsCost = day.stops.reduce((s, stop) => s + stop.poi.price_range, 0);
  const mealsCost = day.meals.reduce((s, meal) => s + meal.dish.price_sar, 0);
  const dailyCostSar = stopsCost + mealsCost;
  return { ...day, dailyCostSar, overBudget: dailyCostSar > budgetPerDay };
}

/**
 * Re-derives the result-level roll-ups after any day's stops changed.
 * Mirrors the tail of generateItinerary exactly — if that changes, change this.
 * `objectives`, `candidateCount`, and `allergenSafeDishCount` are inputs to
 * generation rather than functions of the stops, so they carry through as-is.
 */
export function recalcTotals(result: ItineraryResult, budgetPerDay: number): ItineraryResult {
  const days      = result.days.map((day) => recalcDay(day, budgetPerDay));
  const allStops  = days.flatMap((d) => d.stops);
  const totalCostSar = days.reduce((s, d) => s + d.dailyCostSar, 0);
  const hiddenGemCount = allStops.filter((s) => s.poi.hidden_gem).length;
  const estimatedDailyAvg = days.length > 0 ? totalCostSar / days.length : 0;

  return {
    ...result,
    days,
    totalCostSar,
    verifiedCount:    allStops.filter((s) => isVerified(s.poi)).length,
    hiddenGemShare:   allStops.length > 0 ? hiddenGemCount / allStops.length : 0,
    cultureNoteCount: allStops.filter((s) => !!s.poi.culture_note).length,
    budgetStatus:     estimatedDailyAvg > budgetPerDay ? "over" : "ok",
    estimatedDailyAvg,
  };
}

/* ── Public API ─────────────────────────────────────────────────────── */

export function generateItinerary(
  profile: TravelerProfile,
  trip: TripSpec,
): ItineraryResult {
  // Resolve AI city choice or map new cities to their POI backing dataset
  const resolvedCity = trip.city === "ai"
    ? resolveAiCity(profile, trip)
    : trip.city;
  const poiCity = CITY_POI_MAP[resolvedCity] ?? resolvedCity;

  const objectives    = computeObjectives(profile, trip);
  const cityPois      = (poisData as POI[]).filter(p => p.city === poiCity);
  const userAllergens = profile.allergies ?? [];
  const safeDishes    = (dishesData as Dish[]).filter(d =>
    !d.common_allergens.some(a => userAllergens.includes(a))
  );
  const cityName      = CITY_NAMES[resolvedCity] ?? resolvedCity;

  const days = buildDays(cityPois, safeDishes, objectives, trip, profile, poiCity, cityName);

  const allStops         = days.flatMap(d => d.stops);
  const totalCostSar     = days.reduce((s, d) => s + d.dailyCostSar, 0);
  const verifiedCount    = allStops.filter(s => isVerified(s.poi)).length;
  const hiddenGemCount   = allStops.filter(s => s.poi.hidden_gem).length;
  const hiddenGemShare   = allStops.length > 0 ? hiddenGemCount / allStops.length : 0;
  const cultureNoteCount = allStops.filter(s => !!s.poi.culture_note).length;
  const estimatedDailyAvg = days.length > 0 ? totalCostSar / days.length : 0;

  return {
    days,
    objectives,
    totalCostSar,
    verifiedCount,
    allergenSafeDishCount: safeDishes.length,
    candidateCount: cityPois.length,
    hiddenGemShare,
    cultureNoteCount,
    cityName,
    resolvedCity,
    budgetStatus: estimatedDailyAvg > trip.budget ? "over" : "ok",
    estimatedDailyAvg,
  };
}
