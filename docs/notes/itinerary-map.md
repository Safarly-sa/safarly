---
name: Itinerary destination map
description: Leaflet + OSM raster tiles rendering the active day's route on the itinerary page
---

# Itinerary Destination Map

## Rule
The map is a Leaflet map (plain `leaflet`, no `react-leaflet`) rendered by the
`DestinationMap` component in `itinerary.tsx`. It shows the **currently
selected day's** stops as numbered markers (visit order) connected by a
polyline, auto-fit to the day's bounds. Switching day tabs re-draws the
markers/route without tearing down the underlying `L.Map` instance — only the
`useEffect` keyed on a `stopsKey` (derived from each stop's id + lat/lng) reruns.

## Data
Marker positions come straight from each stop's `poi.lat`/`poi.lng` (already
present on every POI in `lib/poi-data/src/pois.json` — audited when this was built,
no missing coordinates). No new data was needed.

## Tiles & controls
- Raster tiles: `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` — free, no
  API key. `tileerror`/`load` events flip a `tilesOk` flag that shows a small
  non-blocking banner ("map tiles failed to load…") without hiding markers, so
  the feature degrades gracefully offline.
- Leaflet's built-in zoom control is disabled (`zoomControl: false`); the
  existing custom zoom in/out buttons (logical CSS properties, RTL-safe) drive
  `map.zoomIn()`/`zoomOut()` instead, keeping the same UI as before.
- `scrollWheelZoom` starts disabled and is enabled only on mouse-enter of the
  map (disabled again on mouse-leave), so casually scrolling the page past the
  map doesn't get hijacked into a map zoom. Touch drag/pinch use Leaflet's
  normal defaults.

## Google Maps link
`dayRouteMapsUrl()` builds a `google.com/maps/dir/?api=1&origin=…&destination=…
&waypoints=…` URL from the day's stops in order (falls back to a plain
`maps/search` pin link for a single-stop day). This is a *reproduction* of the
day's stop order, not turn-by-turn routing — Leaflet only draws a straight-line
polyline between stops, it does not fabricate roads.

## Why this replaced the OSM-iframe embed
The previous version (single marker, bbox-driven zoom via an
`openstreetmap.org/export/embed.html` iframe) could only ever show one point —
an iframe embed has no API to add multiple markers or a route line, so it
could not satisfy the numbered-multi-stop-route requirement. Leaflet is the
lightest no-API-key library that can draw markers + a polyline + fit bounds on
top of the same free OSM tiles, hence the switch. `leaflet` + `@types/leaflet`
were added to `artifacts/safarly/package.json`.
