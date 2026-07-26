---
name: Safarly engine multi-city + multi-goal
description: How new cities and multi-select goals are handled in the itinerary engine
---

## City mapping
16 cities are selectable in `/trip`. 15 have their own real, researched POI data in
`pois.json` (`riyadh`, `jeddah`, `alula`, `abha`, `taif`, `madinah`, `mecca`, `dammam`,
`dhahran`, `khamis_mushait`, `jazan`, `najran`, `tabuk`, `hail`, `yanbu`) and
`CITY_POI_MAP[city] === city` for all of them — an identity mapping kept explicit
(rather than omitted) so it's obvious at a glance which cities are covered.

**One deliberate, documented exception:** `al_khobar` has no POI dataset of its own yet
and falls back to `riyadh` (`CITY_POI_MAP.al_khobar = "riyadh"`) — a genuine, disclosed
gap, not silently borrowed content. This is the *only* remaining fallback.

**Past incident, now fixed:** `abha`, `taif`, and `madinah` used to fall back to `alula`,
`jeddah`, and `jeddah` respectively — most visibly, choosing "Abha" (Aseer highlands)
produced an itinerary of AlUla's desert/Nabataean-tomb content mislabelled with the
Abha name. All three now have their own real POIs; see git history on
`lib/poi-data/src/pois.json` for the fix.

Mecca's POI set is deliberately thin (3 entries) and every entry's `culture_note`
states the Grand Mosque/Haram area is restricted to Muslims — a factual travel-safety
note, not editorial content; don't pad this city with generic attractions that would
imply unrestricted tourist access.

The `cityName` in ItineraryResult always reflects the displayed city (e.g. "Al Khobar"),
not the backing POI city. Arabic display names live in `engine.ts`'s exported
`CITY_NAMES_AR` — every page needing one imports it rather than hand-copying its own
map; a hand-copied version in `itinerary.tsx` once silently omitted 13 of 16 cities,
falling back to the English name in Arabic mode.

## AI city resolution
`trip.city === "ai"` → `resolveAiCity()` picks from a subset of cities based on moods +
interests + goals (not all 16 — it only knows riyadh/jeddah/alula/abha/madinah today).
`result.resolvedCity` holds the actual city key after resolution (needed by
generating.tsx for Arabic city name lookup).

## Multi-goal blending (goals[])
`TripSpec.goals: string[]` (up to 3). `computeObjectives` averages `GOAL_OBJECTIVES` weights across all selected goals. Backward-compat: `trip.goal: string` (single, legacy) still works.

**Why:** Blending by average keeps each objective contribution proportional to goal count rather than stacking, preventing runaway high scores.
