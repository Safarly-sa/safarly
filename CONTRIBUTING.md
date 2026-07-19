# Contributing to Safarly

## The one rule

**Never commit directly to `main`.** Branch, push, open a pull request.

`main` should always be in a state you'd be happy to deploy. Right now nothing
technically *stops* a direct push — this repo is on GitHub's free plan, where
branch protection isn't available for private repos. That makes this convention
the only thing holding the line, so please hold it.

## Workflow

```bash
git checkout main
git pull                          # always start from current main

git checkout -b short-description # e.g. add-hotel-booking, fix-rtl-navbar
# ... make your changes ...

pnpm run build                    # must pass before you push
git add -A
git commit -m "Describe what changed and why"
git push -u origin short-description

gh pr create                      # or open the PR on github.com
```

Get one teammate to review, then merge. Delete the branch afterwards.

## Before you push

```bash
pnpm run build
```

This typechecks every package and builds the site. It passes on `main` today, so
**a failure means you broke something** — don't push past it, and don't merge a PR
that fails it.

If you only touched the frontend and want a faster loop:

```bash
pnpm --filter @workspace/safarly run dev     # http://localhost:5173
```

## Test both language directions

Safarly ships in 8 languages, two of which are right-to-left (Arabic and Urdu).
A change that looks right in English can be broken in Arabic — this has already
happened once in this codebase.

Before opening a PR that touches layout or components, check both:

```js
// in the browser console
localStorage.setItem('safarly-lang', 'ar'); location.reload();  // RTL
localStorage.setItem('safarly-lang', 'en'); location.reload();  // LTR
```

Read direction from the `dir` value on the i18n context (`useTranslation()`), not
from `document.documentElement.dir` and not by comparing language codes yourself.

## Things that will bite you

- **`lib/api-client-react/` and `lib/api-zod/` are generated.** Edit
  `lib/api-spec/openapi.yaml` and re-run
  `pnpm --filter @workspace/api-spec run codegen` instead.
- **There are two copies of the JSON datasets.** The app reads
  `artifacts/safarly/src/data/`. The top-level `data/` is an older leftover — don't
  edit it expecting the site to change.
- **A brand-new npm release won't install for its first 24 hours.** That's
  `minimumReleaseAge` in `pnpm-workspace.yaml`, a deliberate supply-chain defense.
  Don't disable it; add a targeted exception if you genuinely need one.
- **Don't reintroduce platform-pinning overrides** in `pnpm-workspace.yaml`. The
  Replit config pinned every native binary to linux-x64, which made the repo
  uninstallable on Windows and macOS.

## Commit messages

Explain **why**, not just what — the diff already shows what. If a change fixes
something subtle, say what the broken behaviour was, so the next person doesn't
undo it.

## More context

[CLAUDE.md](CLAUDE.md) has the architecture decisions and the full record of the
migration off Replit. `docs/notes/` covers specific flows (auth, itinerary engine,
dialect practice, maps).
