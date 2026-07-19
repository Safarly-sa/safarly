# Safarly

A Saudi-focused travel companion app — plan trips, browse destinations, scan menus
with Live Lens, and learn local dialect phrases.

## Quick start

Requires **Node.js 24+** and **pnpm 10+**.

```bash
# install pnpm if you don't have it
npm install -g pnpm@10

git clone <repo-url>
cd Safarly
pnpm install

pnpm --filter @workspace/safarly run dev     # -> http://localhost:5173
```

That's it — the frontend runs entirely on local data and needs no database or
API server to start.

### Optional: the API server

```bash
pnpm --filter @workspace/api-server run dev  # -> http://localhost:8080
```

Needs `DATABASE_URL` (a Postgres connection string) for its DB calls. It is
currently a skeleton with only a `/health` route; the frontend does not use it.

## Repo layout

| Path | What |
|---|---|
| `artifacts/safarly/` | **The website.** Pages, components, locales, data |
| `artifacts/api-server/` | Express API (skeleton) |
| `artifacts/mockup-sandbox/` | Design mockup sandbox, not shipped |
| `lib/db/` | Drizzle schema — source of truth for the database |
| `lib/api-spec/openapi.yaml` | API contract — drives codegen |
| `lib/api-client-react/`, `lib/api-zod/` | **Generated** — don't hand-edit |
| `docs/notes/` | Architecture notes on specific flows |
| `docs/research-data/` | Original research corpus — not used at runtime |

## Common commands

```bash
pnpm run typecheck    # typecheck every package
pnpm run build        # typecheck + build every package
pnpm --filter @workspace/safarly run build    # build just the site
```

`pnpm run build` runs the typecheck first and should pass cleanly. If it doesn't,
that's a real regression — please don't merge past it.

## Contributing

**Never commit directly to `main`** — branch, then open a pull request. Run
`pnpm run build` before pushing, and check your change in both English and Arabic
(the app has two right-to-left locales).

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full workflow and the sharp edges.

## Further reading

[CLAUDE.md](CLAUDE.md) has the architecture decisions, gotchas, and the full record
of what changed when this project was migrated off Replit.
