# Auth Portal UX Enhancement — Implementation Plan

**Target agent:** Claude Sonnet, working in the Safarly repo.
**Scope:** `/login` (signup + login), `/forgot-password`, `/reset-password`.
**Status:** Ready to implement. No prior work has started on this.

---

## 0. Read this first

This plan is **executable as written**. Every file path, key name, and function
signature below has been verified against the current code on `main`. Do not
re-research the codebase before starting — go straight to Phase 1.

**Ground rules**

1. **Do not change auth behaviour.** No new endpoints, no session-length changes,
   no changes to what the server accepts or rejects. This is a presentation,
   i18n, and accessibility pass over three pages plus one shared lib refactor.
2. **Do not defeat the account-enumeration defence.** `POST /api/auth/login`
   deliberately returns one generic `"Incorrect email or password."` for both
   "no such user" and "wrong password" (`api-server/src/routes/auth.ts:157`).
   Never map that message to a specific field in the UI.
3. **The locale-parity test is a hard gate.** `src/locales/locales.test.ts` fails
   the suite if any of the 11 locales has a missing, extra, or blank key relative
   to `en.json`. Every key you add to `en.json` must be added to all 10 others
   with a **real translation**, not an English copy-paste.
4. **Run `pnpm run typecheck` and `pnpm run test` after every phase.** Do not
   batch all seven phases and test once.
5. **Inline styles are the house style on these pages.** They use
   `React.CSSProperties` objects and CSS custom properties (`var(--sf-*)`), not
   Tailwind classes. Match that. Do not convert these pages to Tailwind.

---

## 1. What is actually wrong today

Verified findings, with line references:

| # | Problem | Evidence |
|---|---|---|
| 1 | **i18n gap.** The `login.*` namespace has exactly **one** key in `en.json` (`login.returnto.trip_crafting`, line 744). Every other string on all three pages — labels, placeholders, buttons, tab names, tagline, all client error messages — is hardcoded English. | `en.json` has 743 keys total; `grep '"login\.'` returns 1 hit |
| 2 | **`forgot-password.tsx` and `reset-password.tsx` never call `useTranslation()` at all.** They don't even import it. | both files, import blocks |
| 3 | **Password-strength UI duplicated verbatim.** The 4-segment meter + rule checklist is copy-pasted between `login.tsx:280-320` and `reset-password.tsx:153-193`. Identical markup, identical colour ramp, identical bug surface. | both files |
| 4 | **Translation strings baked into a lib.** `assessPassword()` returns English `label` and `firstFailure` strings from `src/lib/validation.ts`. A pure validation lib should not own display copy. | `validation.ts:46-88` |
| 5 | **No field-level errors.** All errors — client and server — land in a single `<p>` at the bottom of the form. The user must map "Please enter your name" back to the right input themselves. | `login.tsx:336-340` |
| 6 | **The error `<p>` has no `aria-live`.** A screen reader user submits, the message appears, and nothing is announced. | all three pages |
| 7 | **No spinner on pending.** Button text swaps to "Logging in…" and the arrow icon disappears. That's the whole loading affordance. | `login.tsx:366-369` |
| 8 | **Inputs lack `aria-invalid` / `aria-describedby`.** Nothing programmatically ties an input to its error. | all three pages |
| 9 | **Server error strings arrive as English prose.** `auth-api.ts` passes `payload.error` straight to the UI. An Arabic user gets a fully-Arabic page with an English error sentence. | `auth-api.ts:45, 117, 140` |
| 10 | **Stale "demo auth" comments.** Two places still claim there's no real backend auth. There is: Express + Drizzle + httpOnly session cookie. | `src/lib/auth.ts`, `docs/notes/safarly-auth.md` |
| 11 | **Visually detached from the app.** Flat `var(--sf-bg)` background while the rest of the app uses the Aurora visual language. | all three pages |

**Bonus finding (server-side, see Phase 7 — optional):**
`POST /api/auth/forgot-password` returns `404 "No account found with that email
address."` (`auth.ts:229`). That is an account-enumeration leak, and it directly
contradicts the generic-error discipline login was built with. Flagged, not
fixed by default — see Phase 7.

---

## 2. Explicitly OUT of scope

Do not implement these. They were considered and rejected for stated reasons.
If you think one is necessary, stop and ask rather than building it.

- **Remember-me / variable session length.** Sessions are an unconditional 30-day
  fixed TTL today. Supporting this needs server schema + session logic changes,
  which is a different piece of work than a frontend polish pass.
- **Session-expiry toast/banner.** Needs a new cross-cutting mechanism (global
  fetch interceptor + a toast primitive) that lives above these three pages, in
  `App.tsx` or a new provider. Out of scope here.
- **Full `AuroraHero` on the auth pages.** Assessed and rejected: `AuroraHero`
  carries pointer-parallax JS and animated blobs sized for a hero. On a 400px
  centred form it fights the form for attention and adds motion cost to the
  first screen a user sees. Use the lightweight CSS-only treatment in Phase 6.
- **Social / OAuth login.** Not in this pass.
- **Rewriting these pages in Tailwind.** They are inline-style pages. Keep them so.

---

## 3. Phase-by-phase implementation

Do these **in order**. Each phase leaves the repo green (typecheck + tests pass).

---

### Phase 1 — `validation.ts`: id-based rules, no display strings

**File:** `artifacts/safarly/src/lib/validation.ts`

The lib currently returns English. Change it to return stable ids; callers
translate. Preserve `PASSWORD_MIN_LENGTH = 10` and `PASSWORD_MAX_LENGTH = 128`
and the existing rule semantics exactly — only the string-carrying fields change.

**New shape:**

```ts
export type PasswordRuleId =
  | "length" | "lower" | "upper" | "number" | "notPersonal";

export interface PasswordRule {
  id: PasswordRuleId;
  passed: boolean;
}

export interface PasswordAssessment {
  rules: PasswordRule[];
  /** Every rule satisfied — the only thing that should enable submit. */
  valid: boolean;
  /** 0-4, for the meter only. Never gates submission. */
  score: number;
  /** Id of the first unmet requirement, for the caller to translate. */
  firstFailureId: PasswordRuleId | null;
}
```

**Changes:**
- Drop `label` from `PasswordRule`.
- Rename `firstFailure: string | null` → `firstFailureId: PasswordRuleId | null`,
  returning `rules.find(r => !r.passed)?.id ?? null`.
- Leave the `score` computation and `isValidEmail()` untouched.
- Keep the existing doc comment about the server mirroring this policy — it's
  still true and still important.

**Update the comment block** to note that display strings now live in the
locales under `password.rule.*`, so a future rule addition needs a matching
key in all 11 locale files.

**Callers to fix in this phase (they will fail typecheck otherwise):**
- `login.tsx:56` — `assessment.firstFailure` → will be rewired in Phase 4
- `login.tsx:315` — `rule.label` → moves into the new component in Phase 2
- `reset-password.tsx:32, 188` — same

To keep the repo green mid-phase, it's fine to do Phase 1 and 2 back to back
before typechecking, since Phase 2 is what consumes the new shape.

**Check for an existing test file:** if `src/lib/validation.test.ts` exists,
update its expectations. If not, add one covering: each rule id flips correctly,
`valid` is all-rules-true, `firstFailureId` returns the first failure in
declaration order, and the identifier check catches both `sara@x.com` and `sara`.

---

### Phase 2 — `PasswordStrengthMeter.tsx` (new shared component)

**File:** `artifacts/safarly/src/components/PasswordStrengthMeter.tsx` (new)

Replaces the duplicated blocks at `login.tsx:280-320` and
`reset-password.tsx:153-193`. Preserve the existing visual design exactly — the
4-segment bar, the same colour ramp, the same Check/X rule list. This is a
de-duplication and i18n refactor, not a redesign.

```tsx
interface PasswordStrengthMeterProps {
  assessment: PasswordAssessment;
  /** Hidden entirely until the user types — an all-red checklist on an empty
      field reads as failure before they've done anything. */
  visible: boolean;
  /** Ties the meter to its input for screen readers. */
  id?: string;
}
```

**Requirements:**
- Renders nothing when `visible` is false.
- Calls `useTranslation()` internally and translates rule labels via
  `password.rule.<id>` (see the key table in Phase 3 for the exact id→key map;
  note `notPersonal` → `password.rule.not_personal`).
- **`{min}` interpolation:** `t()` takes a key only — there is no interpolation
  support in `I18nProvider`. For the length rule, do:
  `t("password.rule.length").replace("{min}", String(PASSWORD_MIN_LENGTH))`.
  Same pattern anywhere else `{min}` or `{score}` appears. Do **not** add
  interpolation to the provider in this pass.
- Colour ramp, unchanged: score ≤1 `#DC2626`, 2 `#F59E0B`, 3 `#84CC16`,
  4 `var(--sf-accent)`; unfilled segments `var(--sf-border)`.
- Replace the current `role="img"` + `aria-label` on the meter bar with a
  proper `role="meter"` carrying `aria-valuenow={score}`, `aria-valuemin={0}`,
  `aria-valuemax={4}`, and an `aria-label` from
  `t("password.strength.label").replace("{score}", String(score))`.
- Add a short text strength word next to the bar —
  `password.strength.weak|fair|good|strong` for scores 1|2|3|4 — so the signal
  isn't colour-only. **This is a WCAG 1.4.1 fix, not decoration.** Keep it small
  (`0.7rem`, `var(--sf-text-muted)`).
- The rule list keeps `aria-hidden` on the Check/X icons; the text carries the
  meaning. Wrap the `<ul>` so it is referenced by the password input's
  `aria-describedby`.

---

### Phase 3 — i18n keys

**58 new keys**, added to `en.json` first, then translated into the other 10
locales: `ar, de, es, fr, it, pt, ru, tr, ur, zh`.

`ar` and `ur` are **RTL** — check that translations read correctly with the
existing `dir="rtl"` handling, and that the `{min}` placeholder survives
translation (translators/models sometimes helpfully "fix" it).

#### `password.*` — 13 keys (shared by login + reset)

| Key | English |
|---|---|
| `password.rule.length` | `At least {min} characters` |
| `password.rule.lower` | `One lowercase letter` |
| `password.rule.upper` | `One uppercase letter` |
| `password.rule.number` | `One number` |
| `password.rule.not_personal` | `Doesn't contain your name or email` |
| `password.strength.label` | `Password strength: {score} of 4` |
| `password.strength.weak` | `Weak` |
| `password.strength.fair` | `Fair` |
| `password.strength.good` | `Good` |
| `password.strength.strong` | `Strong` |
| `password.error.generic` | `Please choose a stronger password.` |
| `password.show` | `Show password` |
| `password.hide` | `Hide password` |

#### `login.*` — 21 new keys (`login.returnto.trip_crafting` already exists)

| Key | English |
|---|---|
| `login.tagline` | `Your Saudi Journey, Intelligently Crafted` |
| `login.tab.signup` | `Sign Up` |
| `login.tab.login` | `Log In` |
| `login.field.name.label` | `Your Name` |
| `login.field.name.placeholder` | `e.g. Sara Al-Ghamdi` |
| `login.field.email.label` | `Email Address` |
| `login.field.email.placeholder` | `you@example.com` |
| `login.field.password.label` | `Password` |
| `login.field.password.placeholder.signup` | `At least {min} characters` |
| `login.field.password.placeholder.login` | `Your password` |
| `login.forgot_link` | `Forgot your password?` |
| `login.submit.signup` | `Create Account` |
| `login.submit.login` | `Log In` |
| `login.submit.signup.pending` | `Creating account…` |
| `login.submit.login.pending` | `Logging in…` |
| `login.switch.have_account` | `Already have an account?` |
| `login.switch.new_here` | `New to Safarly?` |
| `login.error.email.required` | `Please enter your email address.` |
| `login.error.email.invalid` | `Please enter a valid email address, like you@example.com.` |
| `login.error.name.required` | `Please enter your name.` |
| `login.error.password.required` | `Please enter your password.` |

Note: `login.field.email.*` is reused by `forgot-password.tsx` — don't duplicate
it under a `forgot.*` key.

#### `forgot.*` — 9 keys

| Key | English |
|---|---|
| `forgot.title` | `Reset your password` |
| `forgot.intro` | `Enter the email address on your account and we'll give you a link to reset your password.` |
| `forgot.submit` | `Send reset link` |
| `forgot.submit.pending` | `Sending…` |
| `forgot.result.notice` | `Email sending isn't set up yet, so here's your reset link directly — it expires in 1 hour.` |
| `forgot.result.copy` | `Copy reset link` |
| `forgot.result.copied` | `Link copied` |
| `forgot.result.continue` | `Continue to reset password` |
| `forgot.back_to_login` | `Back to log in` |

#### `reset.*` — 8 keys

| Key | English |
|---|---|
| `reset.title` | `Choose a new password` |
| `reset.field.password.label` | `New Password` |
| `reset.field.password.placeholder` | `At least {min} characters` |
| `reset.submit` | `Reset password` |
| `reset.submit.pending` | `Resetting…` |
| `reset.missing.title` | `Missing reset link` |
| `reset.missing.body` | `This page needs a reset link to work. Request a new one below.` |
| `reset.missing.cta` | `Request a reset link` |

#### `auth.error.*` — 7 keys (used by Phase 5's error mapping)

| Key | English |
|---|---|
| `auth.error.offline` | `Can't reach the Safarly server. Make sure the API is running, then try again.` |
| `auth.error.unknown` | `Something went wrong. Please try again.` |
| `auth.error.invalid_credentials` | `Incorrect email or password.` |
| `auth.error.email_taken` | `An account with that email already exists.` |
| `auth.error.rate_limited` | `Too many attempts. Please try again in 15 minutes.` |
| `auth.error.reset_invalid` | `This reset link is invalid or has expired.` |
| `auth.error.not_found` | `No account found with that email address.` |

**Ordering:** insert keys alphabetically within `en.json` if the file is sorted;
otherwise append in namespace blocks. Match whatever convention the file already
uses. Keep all 11 files in the same order so diffs stay reviewable.

---

### Phase 4 — Wire `login.tsx`

**File:** `artifacts/safarly/src/pages/login.tsx`

1. **Translate every string.** Replace all 21 hardcoded strings with `t(...)`
   calls per the table above. The tagline, both tab labels, all three field
   labels and placeholders, the forgot link, both submit labels and both pending
   labels, both switch-hint strings.

2. **Field-level errors.** Replace the single `error: string` state with:
   ```ts
   const [fieldErrors, setFieldErrors] = useState<{
     name?: string; email?: string; password?: string;
   }>({});
   const [formError, setFormError] = useState("");
   ```
   - Deterministic client-side checks (empty name, empty email, malformed email,
     empty password) → `fieldErrors`, rendered directly under the offending input.
   - Password-policy failure and **every server-returned error** → `formError`,
     rendered in the shared region at the bottom.
   - **Critical:** never route a server error into `fieldErrors`. The server
     returns one generic message for both unknown-email and wrong-password
     specifically to prevent account enumeration — field-mapping it client-side
     would tell an attacker which half failed.

3. **ARIA wiring per input:**
   - `aria-invalid={Boolean(fieldErrors.email)}`
   - `aria-describedby` pointing at the error `<p>`'s id (e.g. `login-email-error`),
     and for the password input, additionally at the strength meter's id.
   - Each field error `<p>` gets `id`, `role="alert"`.

4. **Form-level error region** — always rendered, not conditionally mounted, so
   screen readers can observe it:
   ```tsx
   <p id="login-form-error" role="alert" aria-live="assertive" style={{...}}>
     {formError}
   </p>
   ```
   Give it `minHeight` so the button doesn't jump when a message appears.

5. **Clear errors on input.** Clearing `fieldErrors[field]` on change turns the
   error into feedback rather than a scolding that persists while the user fixes it.
   Also clear both on mode toggle (the current code already clears `error` there).

6. **Spinner.** Import `Spinner` from `@/components/ui/spinner` (it already
   exists — `Loader2Icon` + `animate-spin`, with `role="status"`). Render it
   alongside the pending text, replacing the arrow:
   ```tsx
   {submitting ? <><Spinner /> {t("login.submit.login.pending")}</>
               : <>{t("login.submit.login")} <ArrowRight .../></>}
   ```
   Set `aria-busy={submitting}` on the `<form>`.
   **Note:** the global `prefers-reduced-motion` block in `index.css:136-144`
   sets `animation-duration: 0.01ms !important` on everything, which freezes the
   spinner into a static icon. That's acceptable — the pending *text* still
   communicates state — but do not try to override it with `!important`.

7. **`PasswordStrengthMeter`** replaces the inline block:
   ```tsx
   <PasswordStrengthMeter
     id="login-password-strength"
     assessment={assessment}
     visible={mode === "signup" && password.length > 0}
   />
   ```

8. **Show/hide password button** — translate its `aria-label` via
   `password.show` / `password.hide`.

9. **Keep unchanged:** the `AnimatePresence` name-field transition, the redirect
   `useEffect`, `sanitizeReturnTo` handling, the `returnTo` query propagation,
   and all `autoComplete` attributes (`given-name`, `email`, `new-password`,
   `current-password`). Those are correct and password managers depend on them.

---

### Phase 5 — Wire `forgot-password.tsx` and `reset-password.tsx`

Same treatment. Both pages currently **do not import `useTranslation` at all** —
add it.

**`forgot-password.tsx`:**
- Translate all strings per the `forgot.*` table; reuse `login.field.email.*`
  for the email label and placeholder, and `login.error.email.*` for the two
  client-side email errors.
- Field-level error on the email input + `aria-invalid` + `aria-describedby`.
- `role="alert" aria-live="assertive"` on the form-level error region.
- `Spinner` in the pending state.
- The copy-link button: `aria-label` from `forgot.result.copy`, and announce
  success — when `copied` is true, render a visually-hidden `role="status"` with
  `t("forgot.result.copied")`. Right now the only feedback is an icon swap,
  which is invisible to a screen reader.
- Keep the existing "no email provider configured" design decision and its
  explanatory comment. It is deliberate and correct — do not replace the link
  display with a fake "check your email" message.

**`reset-password.tsx`:**
- Translate all strings per the `reset.*` table, including the entire missing-token
  branch (`reset.missing.*`).
- Swap in `PasswordStrengthMeter` with `visible={password.length > 0}`.
- `firstFailureId` → `t(\`password.rule.${...}\`)` for the policy error; fall
  back to `password.error.generic` when null.
- ARIA wiring + `Spinner` as above.
- Keep the redirect-to-`/login`-on-success behaviour and its comment (reset
  invalidates all sessions server-side, so re-login is correct).

**Server error translation (both pages + login):**
Add a small mapper — put it in `src/lib/auth-api.ts` next to the code that
produces the errors, or a new `src/lib/auth-errors.ts`:

```ts
/** Maps the API's English error prose to a locale key.
    Falls back to the server's own string, so a new server-side message
    degrades to English rather than to a blank error. */
export function authErrorKey(serverMessage: string): string | null
```

Match on the known strings from `api-server/src/routes/auth.ts`:
`"Incorrect email or password."` → `auth.error.invalid_credentials`,
`"An account with that email already exists."` → `auth.error.email_taken`,
`"Too many attempts. Please try again in 15 minutes."` → `auth.error.rate_limited`,
`"This reset link is invalid or has expired."` → `auth.error.reset_invalid`,
`"No account found with that email address."` → `auth.error.not_found`,
and the `OFFLINE_MESSAGE` constant → `auth.error.offline`.

String-matching is admittedly brittle. It's chosen over a server change because
this pass is frontend-scoped; the fallback (show the server's English) means a
drift causes a cosmetic regression, not a broken error path. Add a code comment
saying so, and see Phase 7 for the proper fix.

---

### Phase 6 — Visual consistency: `.sf-auth-glow`

**File:** `artifacts/safarly/src/index.css`

Add a CSS-only radial-gradient treatment. No JS, no pointer parallax, no
animated blobs — see the scope-out note on `AuroraHero`.

```css
/* ── Auth pages: quiet Aurora echo ─────────────────────────────────────
   The auth screens sit outside the app shell (no Navbar, no BottomNav), so
   they lose the Aurora visual language the rest of the app carries. This is
   a static, JS-free echo of it: two soft radial pools behind a centred
   400px form. Full AuroraHero was rejected here — its animated blobs and
   pointer-parallax are sized for a hero and fight a login form for
   attention on the first screen a user ever sees. */
.sf-auth-glow {
  position: relative;
  isolation: isolate;
  background:
    radial-gradient(60% 45% at 50% 0%,
      color-mix(in srgb, var(--sf-indigo) 12%, transparent), transparent 70%),
    radial-gradient(55% 40% at 50% 100%,
      color-mix(in srgb, var(--sf-accent) 9%, transparent), transparent 70%),
    var(--sf-bg);
}
:root[data-theme="dark"] .sf-auth-glow,
.dark .sf-auth-glow {
  background:
    radial-gradient(60% 45% at 50% 0%,
      color-mix(in srgb, var(--sf-indigo) 20%, transparent), transparent 70%),
    radial-gradient(55% 40% at 50% 100%,
      color-mix(in srgb, var(--sf-accent) 14%, transparent), transparent 70%),
    var(--sf-bg);
}
```

Apply by adding `className="sf-auth-glow"` to the outer wrapper `<div>` on all
three pages and **removing** the now-redundant `background: "var(--sf-bg)"`
from their inline style objects (the CSS supplies it).

Verify the theme selectors match how the rest of `index.css` scopes dark mode —
it uses `:root[data-theme="dark"]`, `.dark`, **and** a
`@media (prefers-color-scheme: dark)` block in places. Follow the existing
pattern for the aurora band (`index.css:380-395`) rather than inventing a new one.

Also add a shared `.sf-visually-hidden` utility if the codebase doesn't already
have one — Phase 5's copied-link announcement needs it.

---

### Phase 7 — Cleanups, and one optional server fix

**7a. Fix the two stale comments (required).**

- `artifacts/safarly/src/lib/auth.ts` — the header comment claiming demo/no-real-auth.
  Replace with an accurate description: this is a **localStorage mirror of
  `{name, email}`** for synchronous UI reads (Navbar, profile-complete checks).
  It is **not** the session. The session is an httpOnly cookie the server owns;
  `auth-api.ts` is the real client. Keep that warning prominent — it's the kind
  of thing someone will otherwise treat as authoritative.
- `docs/notes/safarly-auth.md` — same correction. The real system is Express +
  Drizzle + httpOnly session cookie, implemented in
  `artifacts/api-server/src/routes/auth.ts`.

Also fix the header comment at the top of `login.tsx:1-6`, which says
"Stores safarly_auth { name, email } in localStorage" without mentioning the
server session — technically true, misleading in isolation.

**7b. Account-enumeration leak in forgot-password (optional — ASK FIRST).**

`api-server/src/routes/auth.ts:229` returns
`404 "No account found with that email address."` This lets anyone test whether
an address has an account — the exact thing login's generic error is designed to
prevent. The standard fix is to always return 200 with a neutral "if that
address has an account, you'll get a link" message.

**This conflicts with the current forgot-password UX**, which shows the reset
link on screen precisely because no email provider is wired up. You cannot both
hide whether the account exists and hand back a working link. Resolving it means
choosing:

- (a) wire up a real email provider, then return the neutral message, or
- (b) accept the leak for now and add a `SECURITY:` comment explaining that it's
  a known, temporary consequence of the no-email-provider state.

**Do not pick one unilaterally.** Report the finding, recommend (b) as the
immediate step with (a) as the pre-release gate, and let the user decide.

---

## 4. Verification

Run after **every** phase, not just at the end:

```bash
pnpm run typecheck
pnpm run test
```

`pnpm run test` runs Vitest across `artifacts/safarly` and `artifacts/api-server`.
The locale-parity test (`src/locales/locales.test.ts`) is the one that will catch
i18n mistakes — it asserts every locale has exactly `en.json`'s keyset, with no
blank values. `ar.json` is allowed extra `poi.*` keys only.

Then a manual pass:

```bash
pnpm --filter @workspace/api-server run dev   # :8080 — needs DATABASE_URL
pnpm --filter @workspace/safarly run dev      # :5173
```

**Manual checklist — walk all three flows in both `en` and `ar`:**

- [ ] Signup: empty name → inline error under the name field, nothing at the bottom
- [ ] Signup: `not-an-email` → inline error under email
- [ ] Signup: weak password → policy message in the **form-level** region, meter shows the unmet rule
- [ ] Signup: valid → spinner appears, redirects to `/profile-setup`
- [ ] Signup with an existing email → translated "account already exists" in the form region
- [ ] Login: wrong password → generic "Incorrect email or password.", **not** attached to either field
- [ ] Login: API server stopped → translated offline message
- [ ] Forgot: valid email → reset link panel, copy button announces success
- [ ] Reset: open `/reset-password` with no `?token` → the missing-link branch, fully translated
- [ ] Reset: valid token + strong password → redirects to `/login`
- [ ] **RTL (`ar` and `ur`):** icons, padding (`insetInlineStart/End`), and the meter bar all mirror correctly; `{min}` renders as `10`, not as literal `{min}`
- [ ] Keyboard only: tab order is sensible, the show/hide toggle is reachable and announces its state
- [ ] Screen reader: submitting with an error announces it (this is the `aria-live` fix)
- [ ] `prefers-reduced-motion: reduce`: nothing spins, pending text still communicates state
- [ ] Light and dark theme: `.sf-auth-glow` is a texture, not a wash — form text stays fully legible

---

## 5. Files touched

**Modified**
- `artifacts/safarly/src/lib/validation.ts`
- `artifacts/safarly/src/lib/auth.ts` (comment only)
- `artifacts/safarly/src/lib/auth-api.ts` (error mapper)
- `artifacts/safarly/src/pages/login.tsx`
- `artifacts/safarly/src/pages/forgot-password.tsx`
- `artifacts/safarly/src/pages/reset-password.tsx`
- `artifacts/safarly/src/index.css`
- `artifacts/safarly/src/locales/*.json` — all 11
- `docs/notes/safarly-auth.md`

**New**
- `artifacts/safarly/src/components/PasswordStrengthMeter.tsx`
- `artifacts/safarly/src/lib/auth-errors.ts` (optional — only if you don't put
  the mapper in `auth-api.ts`)
- `artifacts/safarly/src/lib/validation.test.ts` (only if one doesn't exist)

**Do not touch**
- `artifacts/api-server/**` — unless the user approves Phase 7b
- `lib/api-client-react/`, `lib/api-zod/` — generated from `lib/api-spec/openapi.yaml`

---

## 6. Commit strategy

One commit per phase, so a reviewer can follow the reasoning:

1. `refactor(validation): return rule ids instead of English labels`
2. `feat(auth): extract shared PasswordStrengthMeter component`
3. `i18n(auth): add 58 keys for login/forgot/reset across 11 locales`
4. `feat(login): field-level errors, aria-live, pending spinner, i18n`
5. `feat(auth): wire forgot-password and reset-password for i18n + a11y`
6. `style(auth): add .sf-auth-glow background treatment`
7. `docs: correct stale "demo auth" comments`

Do not push or open a PR without explicit confirmation from the user.

---

## 7. When to stop and ask

- The locale-parity test fails and the fix isn't obviously a typo.
- You find yourself wanting to change anything under `artifacts/api-server/`.
- A translation for one of the 10 non-English locales is one you're not
  reasonably confident in — flag it rather than shipping a guess. `ar` matters
  most here; it's a primary audience locale for this app, not an afterthought.
- Any change that would alter what the server accepts, rejects, or reveals.
