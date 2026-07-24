---
name: Safarly auth layer
description: Real backend auth (httpOnly session cookie) mirrored into a localStorage cache for synchronous UI reads — key names, event system, and shared utility
---

## Rule
`src/lib/auth-api.ts` calls the real API (`POST /api/auth/*`) and is the source of truth —
the server sets an httpOnly session cookie, so there is no token to store. `src/lib/auth.ts`
mirrors `{ name, email }` into localStorage purely so the Navbar and profile-complete checks
can read synchronously without an API round trip. All local reads/writes of that mirror go
through `src/lib/auth.ts`. Never read its localStorage keys directly, and never treat the
mirror as authoritative for anything session-guarded — routes like `/api/concierge/chat` or
`/api/trip/generate` check the real cookie, not this cache.

## Keys
- `safarly_auth` — `{ name: string; email: string }` JSON
- `safarly_profile_complete` — literal string `"true"` when profile setup wizard is done
- `safarly_profile` — `{ name, nationality, language, ageRange, dietary[], allergies[], accessibility, interests[] }` JSON

## Event
`setAuth()` dispatches `new Event("safarly-auth-changed")` on `window`. Navbar and any component that needs to react to login/logout should listen for this event + the `storage` event.

## Routing logic
- `getStartPath()` → `/trip` if auth + profile complete, else `/login`
- `/profile` redirects to `/login` if unauthenticated
- `/profile-setup` redirects to `/` if profile already complete
- `/login` redirects to `/` if already auth + profile complete

**Why:** No real backend auth; this is a demo/prototype. Intentional decision documented to avoid unnecessary complexity.
