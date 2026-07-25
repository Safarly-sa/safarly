# Safarly — Travel Companion

A Saudi-focused travel companion app: plan trips, browse destinations, scan menus
with Live Lens, and learn local dialect phrases.

Migrated off Replit — see "Migration notes" at the bottom for what changed.

## Run & Operate

```bash
pnpm install                                    # first time
pnpm --filter @workspace/safarly run dev        # frontend  -> http://localhost:5173
pnpm --filter @workspace/api-server run dev     # API       -> http://localhost:8080
pnpm run typecheck                              # typecheck all packages
pnpm run build                                  # typecheck + build all packages
pnpm run test                                   # run the safarly + api-server test suites (vitest)
```

- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod
  schemas from the OpenAPI spec (`lib/api-spec/openapi.yaml`)
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, needed only by the
  API server's DB calls. The frontend runs without it.
- Optional env: `PORT` (frontend dev port, default `5173`), `BASE_PATH` (default `/`)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite 7 + Tailwind 4 + wouter (routing) + shadcn/ui (Radix)
- API: Express 5, bundled with esbuild
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval, from the OpenAPI spec

## Where things live

| Path | What |
|---|---|
| `artifacts/safarly/` | **The actual website.** All pages, components, locales, data |
| `artifacts/safarly/src/pages/` | Route components — one file per route |
| `artifacts/safarly/src/lib/engine.ts` | Itinerary generation engine (city + goal logic), plus the post-generation editing primitives (`scheduleStop`, `recalcDay`, `recalcTotals`) the Concierge uses to edit an existing trip |
| `artifacts/safarly/src/lib/auth.ts` | localStorage mirror of `{name,email}` for synchronous UI reads — **not** the auth source of truth, see below |
| `artifacts/safarly/src/lib/auth-api.ts` | The real auth client — calls `/api/auth/*`, session lives in an httpOnly cookie |
| `artifacts/safarly/src/lib/{trip,concierge,dialect}-api.ts` | SSE/JSON clients for the three server-side agents — see Architecture decisions |
| `artifacts/safarly/src/components/AuroraHero.tsx` | Reusable interactive hero backdrop (pointer-parallax + ambient drift); full hero on About/Vision 2030, compact `.sf-aurora-band` header on the tool pages |
| `artifacts/safarly/src/locales/` | 11 locales: ar, de, en, es, fr, it, pt, ru, tr, ur, zh — kept in parity by a test, see Testing |
| `artifacts/safarly/src/data/` | POIs, dishes, phrases (the live copies). `pois.json` carries a `verified` flag: `false` marks entries authored to fill out the pool rather than sourced from research — see the itinerary's "Estimated" badge |
| `artifacts/api-server/` | Express API — auth, Live Lens vision, trip enrichment, the Personal Concierge, and the dialect coach. See Architecture decisions |
| `artifacts/mockup-sandbox/` | Design mockup sandbox, not shipped |
| `lib/db/src/schema/` | Drizzle schema — source of truth for DB |
| `lib/api-spec/openapi.yaml` | API contract — source of truth, drives codegen |
| `lib/api-client-react/`, `lib/api-zod/` | **Generated** from the spec — don't hand-edit |
| `docs/notes/` | Architecture notes on specific flows |
| `docs/research-data/` | Original research corpus. **Partially merged**: 8 POIs + all Arabic POI names have been pulled into the live data (marked `verified: true`); most of the corpus's other entries turned out to be the same landmarks under different names/coordinates, not new places — see its README before mining further |

Routes are declared in `artifacts/safarly/src/App.tsx`.

## Architecture decisions

- **Auth is real, with a localStorage mirror for convenience.** `auth-api.ts` calls
  the API (`/api/auth/*`); the server sets an httpOnly session cookie, so there is
  no token to store. `auth.ts` mirrors `{name,email}` into localStorage purely so
  the Navbar and profile-complete checks can read synchronously — never treat that
  mirror as authoritative for anything session-guarded. See `docs/notes/safarly-auth.md`.
- **The itinerary engine is local-first by design, and stays that way.** `engine.ts`
  builds the day-by-day stops client-side from a curated POI dataset — free,
  offline, and unable to hallucinate places that don't exist. The API layers
  *enrichment* on top (below) rather than replacing it; reimplementing the
  scheduling itself via an LLM was deliberately rejected.
- **Trip enrichment**: `POST /api/trip/generate` (SSE) runs three agents
  concurrently — Events, Transportation, Accommodation — against the itinerary
  the client already built, and streams per-agent completion. Called from
  `generating.tsx` via `lib/trip-api.ts`; always additive, never blocking — any
  failure (offline, no session, timeout) leaves the local itinerary untouched.
- **Transport day legs are computed, not prompted.** Stops are sent to the API
  with their real `lat`/`lng`, and `trip/transport-estimate.ts` derives each
  hop's distance (haversine × a street-detour factor), mode, and duration
  arithmetically; walking vs ride-hail is a distance threshold that tightens in
  the Jun–Sep heat. The model then gets those settled legs and is asked *only*
  for a practical `notes` line — a refinement that can fail without costing the
  traveller the legs. Stops without coordinates fall back to the older
  ask-the-model-for-everything path, which is still there and still weaker.
  Read `leg.basis` for whether the geometry is computed; read `leg.uncertain`
  for whether the *fare* is a guess — the fare constants are unsourced
  order-of-magnitude figures, so computed ride legs stay uncertain. Arrival
  legs are still fully model-driven: there is no airport coordinate table yet.
- **Personal Concierge**: `POST /api/concierge/chat` (SSE) is a stateless
  tool-calling chat — the client sends history + current trip state each turn and
  applies the returned patch itself via `applyConciergePatch()` in
  `lib/concierge-api.ts`. The server validates every proposed action against the
  day's real stops and the candidate POI list before returning it — the model
  proposes, code enforces, so it can never reference an invented place. UI is the
  floating panel in `components/ConciergeChat.tsx` on the itinerary page.
- **Dialect coach**: `POST /api/dialect/evaluate` and `/dialogue` are additive to
  the existing offline `arabicMatch()` check in `dialect.tsx`, which still makes
  the pass/fail call instantly and for free. The agent only adds a coaching tip on
  a failed attempt; if the API is unreachable, practice behaves exactly as it did
  before the agent existed. The agent's own code comment flags Saudi regional
  dialects as low-resource for current models — spot-check output with a native
  speaker before relying on it.
- **Maps use Leaflet + raster OSM tiles** (no API key) to draw the active
  day's numbered stop route on the itinerary page. See
  `docs/notes/itinerary-map.md`.
- **16 cities are selectable, 15 have their own real POI data.** `al_khobar` is the
  one deliberate, disclosed exception, falling back to `riyadh`'s dataset via
  `CITY_POI_MAP`. Abha/Taif/Madinah used to silently borrow other cities' data too
  (most visibly Abha showing AlUla's desert content) — fixed, see
  `docs/notes/safarly-engine-cities.md`.
- **Dialect practice uses the Web Speech API** for real mic input (Chrome/Edge
  only) with a graceful "I said it" fallback. See `docs/notes/dialect-practice-flow.md`.
- **Demo mode**: every agent route falls back to canned fixtures when
  `AGENTS_DEMO_MODE=true` or no `GEMINI_API_KEY` is configured — the whole stack
  is buildable and testable without a live key. The real Gemini streaming shapes
  (concierge tool-calls, token streaming) are unverified against a live key as of
  this writing; treat that as a pre-release gate, not a formality.

## Testing

`pnpm run test` runs Vitest across both `artifacts/safarly` and `artifacts/api-server`
(each has its own `vitest.config.ts`; there is no root config). Coverage is deliberately
narrow and high-value rather than exhaustive: pure logic only, no DOM, no booting Express.

- `engine.test.ts`, `concierge-api.test.ts`, `trip-api.test.ts` — generation invariants and
  the two client-side edit/enrichment merges (both must be non-mutating and additive).
- `allergens.test.ts` — the two-shape allergy bug from the migration (`"nuts"` vs
  `"ob.allergy.nuts"`); a regression here silently drops allergy warnings.
- `poi-i18n.test.ts` — the key-echo fallback (`t()` returns the key itself when a
  translation is missing) that keeps untranslated POIs from rendering raw keys.
- `concierge-tools.test.ts` (api-server) — the server-side guard that stops the model from
  proposing an edit referencing an invented POI id.
- `*-validate.test.ts` (api-server) — the request validators; the trust boundary in front
  of all three agent routes. `trip-validate` is also the gate in front of the haversine:
  a bad lat/lng that slips through comes back as a confident-looking distance built from
  garbage, so its coordinate-rejection cases matter more than their size suggests.
- `transport-estimate.test.ts`, `transport-agent.test.ts` (api-server) — the computed
  transport legs. Pins the real Riyadh distances and the hot-season walk threshold, and
  guards demo mode against regressing to the flat "15 min / 20 SAR for every hop" fixture
  it used to return regardless of whether two stops were 200m or 30km apart.
- `locales/locales.test.ts` — **locale drift guard.** Fails the suite if any locale's
  keyset differs from `en.json` (missing, extra, or blank values). This exists because
  `t()` echoing the key on a miss means a lagging locale fails silently in the running
  app — the gap is only visible in code, which is why it needs a test, not just a glance.
  `ar.json` is allowed extra `poi.*.name` keys by design; every other locale must match
  `en.json` exactly.

## Gotchas

- **`SpeechRecognition` is declared locally**, in
  `artifacts/safarly/src/types/speech-recognition.d.ts` — TypeScript's `lib.dom`
  does not ship it. Extend that file rather than reaching for `as any`.
- **Two dataset families exist, and they are not duplicates.**
  `artifacts/safarly/src/data/*.json` is what the app imports — edit that one.
  `docs/research-data/*.json` is the original research corpus: different ids,
  different schema, and it holds dish origin stories the live data still lacks.
  Its POI Arabic names and 8 genuinely-new POIs have already been merged into
  the live data; most of the rest turned out to be the same landmarks under
  different names/coordinates on inspection, not new places — coordinate-match
  before merging any more of it. See its README.
- **`pois.json`'s `verified` flag drives the itinerary's Verified/Estimated
  badge** — absent or `true` means researched coordinates, `false` means
  authored to fill out the pool (real place, approximate pin and price). Two
  known-bad coordinates were found and fixed this way: the original data placed
  "Edge of the World" southwest of Riyadh (it's northwest, on the Tuwaiq
  escarpment) and mislabelled a Riyadh public-art row as "(Ithra)" — Ithra is in
  Dhahran, ~400km away, and now has its own real POI entry there (`dhahran_ithra`).
  The Riyadh entry was renamed again to "(JAX District)" when the "(Ithra)"
  parenthetical resurfaced during the 16-city data expansion — if it comes back a
  third time, check whether something is auto-generating that name. Verify before
  trusting any single POI's exact pin.
- `lib/api-client-react/` and `lib/api-zod/` are **generated**. Change
  `lib/api-spec/openapi.yaml` and re-run codegen instead of editing them.
- `pnpm-workspace.yaml` sets `minimumReleaseAge: 1440` — a brand-new npm release
  will be refused for its first 24h. This is an intentional supply-chain defense.
- `NODE_ENV` is only ever compared against `"production"` (`api-server/src/lib/logger.ts`),
  so leaving it unset in dev is equivalent to setting it to `development`.

## Migration notes (off Replit)

Removed during migration — do not reintroduce:

- `.replit`, `.replitignore`, `replit.nix`, `.replit-artifact/` directories
- `@replit/vite-plugin-cartographer`, `-dev-banner`, `-runtime-error-modal`
- `@replit/connectors-sdk`, and the `sh -c` preinstall guard
- `pnpm-workspace.yaml` overrides that pinned every native binary to linux-x64,
  which made the workspace uninstallable on Windows and macOS
- `vite.config.ts` used to **throw** unless Replit-injected `PORT` and `BASE_PATH`
  were set; both now have local defaults

Git history was preserved on `main`. Four stale mirror branches from the Replit
side (`replit-agent`, three `subrepl-*`) hold duplicate commits under different
SHAs and were deliberately kept local-only, never pushed — don't count them when
sizing history, and don't push them without a reason to. The old Replit-internal
git remotes (`gitsafe`, `ssh.sisko.replit.dev`) were removed — add your own
remote when ready.
