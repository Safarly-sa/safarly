---
name: Installable app (PWA)
description: Manifest, service worker, offline scope, and the install/update prompts
---

# Installable App (PWA)

## Rule
Safarly installs to a phone home screen as a PWA. There is no native shell and
no app-store build — the same React app that serves the website is the app,
wrapped by a web manifest and a Workbox service worker generated at build time
by `vite-plugin-pwa` (configured inline in `artifacts/safarly/vite.config.ts`).

This was chosen over Capacitor and over a React Native rewrite because the whole
UI layer carries over unchanged: 20 pages, 11 locales, the Leaflet map and the
shadcn/Radix design system all ship as-is, and there are no store accounts or
signing keys in the release path.

## What works offline, and what does not
The service worker precaches the app shell **and every lazy route chunk** — 77
entries, ~2.6 MB. The POI, dish and phrase datasets are plain `import`s, so they
are already inside those chunks and come along for free.

Works with no connection:
- the itinerary (generated locally by `lib/engine.ts` — see CLAUDE.md)
- the dialect phrasebook, including the offline `arabicMatch()` pass/fail check
- destination browsing, dishes, allergen warnings
- map tiles **already panned over** (runtime-cached, 400 tiles / 30 days)

Does not work with no connection, by design:
- trip enrichment, the Personal Concierge, Live Lens vision — all API-backed
- map tiles never visited

That split is deliberate. Those three already degrade gracefully when the API is
unreachable, so leaving them uncached fails exactly the way they already fail
rather than serving a stale answer that looks live. `/api` is excluded from the
navigation fallback for the same reason.

## Install prompts
Two entirely different browser contracts, resolved in one place by
`resolveInstallRoute()` in `lib/pwa.ts`:

- **Chromium** fires `beforeinstallprompt`, a deferred prompt the page can
  replay on a tap. It is caught by an **inline script in `index.html`**, not by
  a React listener — Chromium routinely fires it before the module bundle has
  parsed, and a component listener misses the only event it will ever get. The
  script stashes it on `window.__safarlyInstallPrompt` and re-announces it as
  `safarly-install-available`.
- **WebKit/iOS** fires nothing and exposes no install API at all. The only route
  is Share → Add to Home Screen, so the card just shows the user where it is.

The card waits 15s before appearing, and a dismissal snoozes it for 30 days.
Declining Chromium's own OS dialog counts as a dismissal.

`lib/pwa.ts` holds the eligibility rules as pure functions so they can be tested
without a DOM (`lib/pwa.test.ts`); `components/PWAProvider.tsx` is presentation
and browser plumbing only. The update card and the install card share one bottom
slot and an update always outranks an install.

## iOS specifics
Safari reads **none** of the web manifest for Add to Home Screen. The
`apple-mobile-web-app-*` tags in `index.html` are what it uses instead, so the
two have to be kept in step by hand. The `apple-touch-icon` must be a PNG —
Safari rejects the SVG favicon, and an install with no usable icon falls back to
a screenshot of the page.

`viewport-fit=cover` lets the installed app paint under the notch and the home
indicator. That is what switches on the `env(safe-area-inset-*)` values, so the
fixed chrome heights became the `--sf-navbar-h` / `--sf-bottomnav-h` tokens in
`index.css` — they fold the insets in and collapse to the old bare 68px/64px
everywhere else.

## Icons
Sources are `public/icons/icon.svg` (`purpose: any`) and `icon-maskable.svg`,
which shrinks the mark to ~63% so Android's adaptive mask cannot crop it. PNGs
are committed next to them because a browser reads the manifest's icons straight
off the static host, with no build step in between.

Regenerate with `pnpm --filter @workspace/scripts run icons`. That needs a
**chrome-headless-shell** binary, not a full Chrome: full Chrome's new headless
mode maps `--window-size` to a viewport ~60px shorter and pads the screenshot
back out, producing icons with a blank band that look plausible enough to commit
by accident. The script fails loudly on a size mismatch for that reason.

## Testing it
`devOptions` is off, so there is no service worker on the Vite dev server — a
SW caching a dev server is a debugging trap. Exercise the real thing with:

```bash
pnpm --filter @workspace/safarly run build
pnpm --filter @workspace/safarly run serve   # http://localhost:5173
```

`localhost` counts as a secure context, so install, precache and update all
behave as they do in production.

## Deploy note
`public/_headers` carries a permanent `Cache-Control: max-age=0` rule for
`/sw.js`. It is the only file whose URL is stable across deploys — every asset
it precaches is content-hashed — so a CDN holding an old copy pins installed
users to the old precache manifest. That file also still holds the temporary
`noindex` block; the header comments say which is which.
