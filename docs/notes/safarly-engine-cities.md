---
name: Safarly engine multi-city + multi-goal
description: How new cities and multi-select goals are handled in the itinerary engine
---

## City mapping
New cities without dedicated POI data fall back to the nearest dataset city via `CITY_POI_MAP`:
- `al_khobar` → `riyadh` POIs
- `abha` → `alula` POIs  
- `taif` → `jeddah` POIs
- `madinah` → `jeddah` POIs

The `cityName` in ItineraryResult always reflects the displayed city (e.g. "Al Khobar"), not the backing POI city.

## AI city resolution
`trip.city === "ai"` → `resolveAiCity()` picks from all 8 cities based on moods + interests + goals.
`result.resolvedCity` holds the actual city key after resolution (needed by generating.tsx for Arabic city name lookup).

## Multi-goal blending (goals[])
`TripSpec.goals: string[]` (up to 3). `computeObjectives` averages `GOAL_OBJECTIVES` weights across all selected goals. Backward-compat: `trip.goal: string` (single, legacy) still works.

**Why:** Blending by average keeps each objective contribution proportional to goal count rather than stacking, preventing runaway high scores.
