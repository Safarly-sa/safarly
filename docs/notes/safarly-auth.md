---
name: Safarly auth layer
description: localStorage-only auth approach, key names, event system, and shared utility
---

## Rule
All auth reads/writes go through `src/lib/auth.ts`. Never read localStorage keys directly.

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
