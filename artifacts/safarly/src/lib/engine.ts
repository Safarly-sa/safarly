/**
 * Safarly Itinerary Engine
 * generateItinerary(profile, trip) → ItineraryResult
 *
 * Pure, synchronous — no API calls. All data from bundled JSON.
 */

import poisRaw from "@/data/pois.json";
import dishesRaw from "@/data/dishes.json";

// ── Types ──────────────────────────────────────────────────────────────────

export interface Profile {
  nationality: string;
  language: string;
  ageRange: string;
  dietary: string[];
  allergies: string[];
  travelType: string;
  accessibility: boolean;
  interests: string[];
}

export interface Trip {
  city: string;
  dateStart: string;
  dateEnd: string;
  budget: number;
  moods: string[];
  goal: string;
  customGoal?: string;
}

export interface Objectives {
  culture: number;
  budget: number;
  hiddenGems: number;
  food: number;
  family: number;
  photography: number;
}

export interface POI {
  id: string;
  city: string;
  name_en: string;
  name_ar: string;
  category: string;
  hidden_gem: boolean;
  lat: number;
  lng: number;
  gmaps_url: string;
  cultural_note: string;
  best_time: string;
  price_range: number;
  family_friendly: boolean;
  accessible: boolean;
}

export interface Dish {
  name_en: string;
  name_ar: string;
  description: string;
  region_origin_story: string;
  common_allergens: string[];
  typical_price_sar: number;
}

export interface DayStop {
  slot: "morning" | "midday" | "afternoon" | "evening";
  poi: POI;
}

export interface DayMeal {
  slot: "lunch" | "dinner";
  dish: Dish;
}

export interface DayPlan {
  dayNum: number;
  date: string;
  stops: DayStop[];
  meals: DayMeal[];
  estimatedCostSar: number;
  overBudget: boolean;
  /** Prayer-time gap markers inserted into the timeline */
  prayerMarkers: Array<{ label: string; time: string }>;
}

export interface ItineraryResult {
  days: DayPlan[];
  objectives: Objectives;
  totalCostSar: number;
  /** Stops that carry a verified Google Maps link */
  verifiedCount: number;
  /** POIs in the city pool before applying profile filters */
  candidateCount: number;
  /** Dishes with zero allergen conflicts for this traveller */
  safeDishCount: number;
  /** Percentage of stops that are hidden gems (0–100) */
  hiddenGemShare: number;
  /** Stops that carry a non-empty cultural note */
  culturalNotesCount: number;
}

// ── Constants ──────────────────────────────────────────────────────────────

const ALL_POIS = poisRaw as POI[];
const ALL_DISHES = dishesRaw as Dish[];

/** Normalise the city slug saved by trip.tsx → pois.json spelling */
const CITY_MAP: Record<string, string> = {
  riyadh: "Riyadh",
  jeddah: "Jeddah",
  alula: "AlUla",
};

/**
 * Base objective weights per journey goal.
 * Keys match trip.tsx goal card `key` props.
 */
const GOAL_WEIGHTS: Record<string, Objectives> = {
  culture:  { culture: 0.9, food: 0.3, hiddenGems: 0.2, budget: 0.2, family: 0.2, photography: 0.3 },
  food:     { culture: 0.3, food: 0.9, hiddenGems: 0.3, budget: 0.2, family: 0.2, photography: 0.2 },
  gems:     { culture: 0.4, food: 0.3, hiddenGems: 0.9, budget: 0.3, family: 0.1, photography: 0.4 },
  family:   { culture: 0.3, food: 0.4, hiddenGems: 0.1, budget: 0.4, family: 0.9, photography: 0.2 },
  budget:   { culture: 0.4, food: 0.5, hiddenGems: 0.4, budget: 0.9, family: 0.3, photography: 0.2 },
  photo:    { culture: 0.4, food: 0.2, hiddenGems: 0.5, budget: 0.2, family: 0.2, photography: 0.9 },
  spiritual:{ culture: 0.8, food: 0.3, hiddenGems: 0.2, budget: 0.3, family: 0.3, photography: 0.2 },
};

/** Delta applied per active mood chip */
const MOOD_BOOSTS: Record<string, Partial<Objectives>> = {
  adventure:   { hiddenGems: 0.15 },
  romantic:    { photography: 0.1 },
  luxury:      { budget: -0.3 },
  spiritual:   { culture: 0.15 },
  family:      { family: 0.2 },
  photography: { photography: 0.2 },
  food:        { food: 0.2 },
};

/** Delta applied per selected interest */
const INTEREST_BOOSTS: Record<string, Partial<Objectives>> = {
  history:     { culture: 0.15 },
  food:        { food: 0.15 },
  adventure:   { hiddenGems: 0.1 },
  arts:        { culture: 0.1, photography: 0.1 },
  nature:      { hiddenGems: 0.1 },
  photography: { photography: 0.15 },
};

/** Which traveller interest keys each POI category satisfies */
const CATEGORY_INTERESTS: Record<string, string[]> = {
  museum:       ["history", "arts"],
  heritage:     ["history", "arts"],
  entertainment:["adventure", "shopping"],
  market:       ["shopping", "food"],
  nature:       ["nature", "adventure", "photography"],
  landmark:     ["history", "photography"],
};

/** Categories considered "indoor" — preferred for the midday heat window */
const INDOOR_CATS = new Set(["museum", "entertainment", "market"]);

/** Rough per-person visit cost in SAR by price_range integer */
const PRICE_SAR: Record<number, number> = { 1: 50, 2: 120, 3: 250 };

/** Prayer-time gaps inserted as timeline markers in every day */
const PRAYER_MARKERS = [
  { label: "Dhuhr", time: "12:00" },
  { label: "Asr",   time: "15:30" },
  { label: "Maghrib", time: "18:00" },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Return number of trip days clamped to [1, 14] */
function tripDayCount(start: string, end: string): number {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (isNaN(s) || isNaN(e)) return 1;
  const diff = Math.round((e - s) / 86_400_000);
  return Math.max(1, Math.min(diff + 1, 14));
}

/** Add n calendar days to a YYYY-MM-DD string */
function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// ── Objective computation ──────────────────────────────────────────────────

function computeObjectives(profile: Profile, trip: Trip): Objectives {
  const base = GOAL_WEIGHTS[trip.goal] ?? GOAL_WEIGHTS["culture"];
  const obj: Objectives = { ...base };

  // Mood boosts
  for (const mood of trip.moods ?? []) {
    const boost = MOOD_BOOSTS[mood];
    if (!boost) continue;
    for (const k of Object.keys(boost) as (keyof Objectives)[]) {
      obj[k] = clamp01(obj[k] + (boost[k] ?? 0));
    }
  }

  // Interest boosts
  for (const interest of profile.interests ?? []) {
    const boost = INTEREST_BOOSTS[interest];
    if (!boost) continue;
    for (const k of Object.keys(boost) as (keyof Objectives)[]) {
      obj[k] = clamp01(obj[k] + (boost[k] ?? 0));
    }
  }

  return obj;
}

// ── POI scoring ────────────────────────────────────────────────────────────

function scorePoi(poi: POI, obj: Objectives, profile: Profile): number {
  let score = 0;

  // Interest category alignment
  const cats = CATEGORY_INTERESTS[poi.category] ?? [];
  if (cats.some((c) => (profile.interests ?? []).includes(c))) score += 0.4;

  // Hidden-gem bonus weighted by hiddenGems objective
  if (poi.hidden_gem) score += obj.hiddenGems * 0.4;

  // Culture affinity for heritage/museum
  if (["museum", "heritage"].includes(poi.category)) score += obj.culture * 0.2;

  // Photography affinity for scenic categories
  if (["nature", "landmark"].includes(poi.category) && obj.photography > 0.4) {
    score += obj.photography * 0.15;
  }

  // Budget traveller prefers cheap POIs
  if (poi.price_range === 1 && obj.budget > 0.5) score += 0.15;
  // Penalise expensive POIs for strict budget travellers
  if (poi.price_range === 3 && obj.budget > 0.65) score -= 0.2;

  return score;
}

// ── Greedy slot picker ─────────────────────────────────────────────────────

interface SlotPrefs {
  preferBestTime?: string;
  preferIndoor?: boolean;
  avoidEvening?: boolean;
}

/**
 * Pick the best available POI for a slot.
 * Among top-scoring candidates (within 0.15 of the best score),
 * prefer the one nearest to `lastPos` to minimise hop distance.
 */
function pickStop(
  pool: POI[],
  usedIds: Set<string>,
  prefs: SlotPrefs,
  lastPos: { lat: number; lng: number } | null,
  obj: Objectives,
  profile: Profile,
): POI | null {
  const available = pool.filter((p) => !usedIds.has(p.id));
  if (available.length === 0) return null;

  const scored = available.map((poi) => {
    let s = scorePoi(poi, obj, profile);
    if (prefs.preferBestTime && poi.best_time === prefs.preferBestTime) s += 0.3;
    if (prefs.preferIndoor && INDOOR_CATS.has(poi.category)) s += 0.25;
    if (prefs.avoidEvening && poi.best_time !== "evening") s += 0.1;
    return { poi, score: s };
  });

  scored.sort((a, b) => b.score - a.score);

  // Candidate band: top score ± 0.15
  const topScore = scored[0].score;
  const candidates = scored.filter((s) => s.score >= topScore - 0.15);

  // Within band, prefer nearest to last position
  if (lastPos && candidates.length > 1) {
    candidates.sort((a, b) => {
      const da = haversineKm(lastPos.lat, lastPos.lng, a.poi.lat, a.poi.lng);
      const db = haversineKm(lastPos.lat, lastPos.lng, b.poi.lat, b.poi.lng);
      return da - db;
    });
  }

  return candidates[0].poi;
}

// ── Main export ────────────────────────────────────────────────────────────

export function generateItinerary(profile: Profile, trip: Trip): ItineraryResult {
  const cityName = CITY_MAP[trip.city?.toLowerCase()] ?? trip.city;
  const obj = computeObjectives(profile, trip);

  // ── 1. Filter candidate POI pool ──────────────────────────────────────
  const cityPois = ALL_POIS.filter((p) => {
    if (p.city !== cityName) return false;
    if (profile.travelType === "family" && !p.family_friendly) return false;
    if (profile.accessibility && !p.accessible) return false;
    return true;
  });

  const candidateCount = cityPois.length;

  // ── 2. Allergen-safe dishes ───────────────────────────────────────────
  const userAllergies = (profile.allergies ?? []).map((a) => a.toLowerCase());
  const safeDishes = ALL_DISHES.filter(
    (d) => !d.common_allergens.some((a) => userAllergies.includes(a.toLowerCase())),
  );

  // ── 3. Build days ─────────────────────────────────────────────────────
  const numDays = tripDayCount(trip.dateStart, trip.dateEnd);
  const usedPoiIds = new Set<string>(); // no repeats across all days
  const days: DayPlan[] = [];

  for (let di = 0; di < numDays; di++) {
    const dayStops: DayStop[] = [];

    // Morning — prefer best_time="morning" POIs
    const morningPoi = pickStop(cityPois, usedPoiIds, { preferBestTime: "morning" }, null, obj, profile);
    let lastPos: { lat: number; lng: number } | null = null;
    if (morningPoi) {
      usedPoiIds.add(morningPoi.id);
      dayStops.push({ slot: "morning", poi: morningPoi });
      lastPos = { lat: morningPoi.lat, lng: morningPoi.lng };
    }

    // Midday (12:00–15:00 heat window) — prefer indoor categories
    const middayPoi = pickStop(cityPois, usedPoiIds, { preferIndoor: true }, lastPos, obj, profile);
    if (middayPoi) {
      usedPoiIds.add(middayPoi.id);
      dayStops.push({ slot: "midday", poi: middayPoi });
      lastPos = { lat: middayPoi.lat, lng: middayPoi.lng };
    }

    // Afternoon — any, avoid saving best evening spots for daytime
    const afternoonPoi = pickStop(cityPois, usedPoiIds, { avoidEvening: true }, lastPos, obj, profile);
    if (afternoonPoi) {
      usedPoiIds.add(afternoonPoi.id);
      dayStops.push({ slot: "afternoon", poi: afternoonPoi });
      lastPos = { lat: afternoonPoi.lat, lng: afternoonPoi.lng };
    }

    // Evening — prefer best_time="evening" POIs
    const eveningPoi = pickStop(cityPois, usedPoiIds, { preferBestTime: "evening" }, lastPos, obj, profile);
    if (eveningPoi) {
      usedPoiIds.add(eveningPoi.id);
      dayStops.push({ slot: "evening", poi: eveningPoi });
    }

    // ── Meals: cycle through safe dishes, no back-to-back repeats ──────
    const dayMeals: DayMeal[] = [];
    if (safeDishes.length > 0) {
      const lunchIdx = (di * 2) % safeDishes.length;
      const dinnerIdx = (di * 2 + 1) % safeDishes.length;
      dayMeals.push({ slot: "lunch", dish: safeDishes[lunchIdx] });
      dayMeals.push({ slot: "dinner", dish: safeDishes[dinnerIdx] });
    }

    // ── Budget estimate ─────────────────────────────────────────────────
    const stopCostSar = dayStops.reduce((s, st) => s + (PRICE_SAR[st.poi.price_range] ?? 80), 0);
    const mealCostSar = dayMeals.reduce((s, m) => s + m.dish.typical_price_sar, 0);
    const estimatedCostSar = stopCostSar + mealCostSar;

    days.push({
      dayNum: di + 1,
      date: addDays(trip.dateStart, di),
      stops: dayStops,
      meals: dayMeals,
      estimatedCostSar,
      overBudget: estimatedCostSar > trip.budget,
      prayerMarkers: PRAYER_MARKERS,
    });
  }

  // ── 4. Aggregate stats ────────────────────────────────────────────────
  const totalCostSar = days.reduce((s, d) => s + d.estimatedCostSar, 0);

  const allStops = days.flatMap((d) => d.stops);
  const verifiedCount = allStops.filter((s) => !!s.poi.gmaps_url).length;
  const hiddenCount = allStops.filter((s) => s.poi.hidden_gem).length;
  const hiddenGemShare =
    allStops.length > 0 ? Math.round((hiddenCount / allStops.length) * 100) : 0;
  const culturalNotesCount = allStops.filter(
    (s) => s.poi.cultural_note && s.poi.cultural_note.length > 0,
  ).length;

  return {
    days,
    objectives: obj,
    totalCostSar,
    verifiedCount,
    candidateCount,
    safeDishCount: safeDishes.length,
    hiddenGemShare,
    culturalNotesCount,
  };
}
