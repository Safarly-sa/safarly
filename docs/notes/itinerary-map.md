---
name: Itinerary destination map
description: OpenStreetMap embed with zoom controls on the itinerary page
---

# Itinerary Destination Map

## Rule
The map is an OSM iframe rendered by `DestinationMap` component in `itinerary.tsx`. Zoom is React state (default 13, range 10–17). Zoom in/out buttons update state → iframe `key` changes → browser re-fetches the new bbox URL.

## URL formula
`https://www.openstreetmap.org/export/embed.html?bbox={lng-d},{lat-d},{lng+d},{lat+d}&layer=mapnik&marker={lat},{lng}`

Delta `d` lookup: `ZOOM_DELTAS = [0.35, 0.18, 0.09, 0.045, 0.022, 0.011, 0.006, 0.003]` indexed by `zoom - 10`.

## City coordinates
`CITY_COORDS` maps lowercase city keys (riyadh, jeddah, madinah, makkah, abha, alula, taif, khobar, dammam, neom, ai) to `[lat, lng]`. Falls back to Riyadh if unrecognised.

## Placement
Rendered below the `sf-itin-layout` grid, inside the `max-w-1100` container, before the POI photo modal and fixed wrench button.

**Why:** No Leaflet/Mapbox dependency needed; OSM embed is free, requires no API key, and supports bbox-based zoom control via URL parameter.
