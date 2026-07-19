# Research data (not used at runtime)

**Nothing imports these files.** The app reads `artifacts/safarly/src/data/`.

This is the original research corpus the project was built from — the output of the
content-research prompt kept in `attached_assets/`. It was moved here (from the
repo root, where it sat next to nothing that read it) because it kept being
mistaken for a stale duplicate of the live data.

It is **not** a duplicate. It is a different dataset, with different IDs and a
different schema, and it holds material the live copies do not:

| | This folder | `artifacts/safarly/src/data/` |
|---|---|---|
| POI ids | `ruh-001` | `ruh_masmak` |
| POI names | `name_en` **+ `name_ar`** | `name` (English only) |
| Cultural notes | `cultural_note` — paragraph-length | `culture_note` — one line |
| Dishes | **`region_origin_story`** — origin essays | no equivalent |
| Also here | `gmaps_url`, `best_time`, `typical_price_sar` | — |
| Only in live data | — | `duration_hrs`, `indoor`, `best_slot`, `meal_type`, `food_weight` |

Counts differ too: 45 POIs / 20 dishes / 30 phrases here, versus 42 / 20 / 80 live.

## Why keep it

The Arabic POI names and the dish origin stories exist **only here**. For an app
that ships 8 locales including Arabic, that content is worth mining rather than
discarding — the live POI data currently has no Arabic names at all.

The extra fields on the live side (`duration_hrs`, `best_slot`, `indoor`) are what
the itinerary engine schedules against, so the live schema can't simply be replaced
with this one. Merging would mean mapping the two id schemes onto each other.

## If you change these files

Nothing will happen. To change what the app shows, edit
`artifacts/safarly/src/data/` instead.
