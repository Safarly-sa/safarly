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
| `artifacts/safarly/src/lib/engine.ts` | Itinerary generation engine (city + goal logic) |
| `artifacts/safarly/src/lib/auth.ts` | Auth layer — **the only** place localStorage auth is touched |
| `artifacts/safarly/src/locales/` | 8 locales: ar, de, en, fr, it, ru, ur, zh |
| `artifacts/safarly/src/data/` | POIs, dishes, phrases (the live copies) |
| `artifacts/api-server/` | Express API — currently only a `/health` route |
| `artifacts/mockup-sandbox/` | Design mockup sandbox, not shipped |
| `lib/db/src/schema/` | Drizzle schema — source of truth for DB |
| `lib/api-spec/openapi.yaml` | API contract — source of truth, drives codegen |
| `lib/api-client-react/`, `lib/api-zod/` | **Generated** from the spec — don't hand-edit |
| `data/` | Older top-level copies of the JSON datasets (see Gotchas) |
| `docs/notes/` | Architecture notes on specific flows |

Routes are declared in `artifacts/safarly/src/App.tsx`.

## Architecture decisions

- **Auth is localStorage-only** — no backend auth. Deliberate, this is a prototype.
  See `docs/notes/safarly-auth.md`.
- **Maps use an OpenStreetMap iframe**, not Leaflet/Mapbox — no API key, no
  dependency, zoom driven by bbox URL params. See `docs/notes/itinerary-map.md`.
- **Cities without their own POI data fall back to a backing city's dataset** via
  `CITY_POI_MAP`, while still displaying their real name. See
  `docs/notes/safarly-engine-cities.md`.
- **Dialect practice uses the Web Speech API** for real mic input (Chrome/Edge
  only) with a graceful "I said it" fallback. See `docs/notes/dialect-practice-flow.md`.
- The API server is a near-empty skeleton — the frontend currently runs entirely
  on local data and does not depend on it.

## Gotchas

- **Two copies of the datasets exist.** `artifacts/safarly/src/data/*.json` is what
  the app imports; the top-level `data/*.json` is an older, differently-sized copy.
  Edit the one under `artifacts/safarly/`. Consider deleting the top-level copy.
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

Git history (84 commits) was preserved. The old Replit-internal git remotes
(`gitsafe`, `ssh.sisko.replit.dev`) were removed — add your own remote when ready.
