/**
 * Whether agent routes should call Gemini for real or return canned fixtures.
 *
 * Three cases this exists for:
 *   1. No GEMINI_API_KEY configured at all — without this, every agent route
 *      501/503s and the frontend is undevelopable by anyone who hasn't set up
 *      a key yet.
 *   2. A deployed demo/staging environment that should never spend the shared
 *      free-tier quota (10 RPM / 250 RPD across ALL users) on random traffic.
 *   3. A developer who HAS a key but is iterating on frontend layout and
 *      doesn't want every hot-reload to burn a real request.
 *
 * AGENTS_DEMO_MODE is explicit opt-in/opt-out; unset means "demo unless a key
 * is configured" — the safe default for a screenshot-only preview deploy.
 */
export function isDemoMode(): boolean {
  const flag = process.env.AGENTS_DEMO_MODE;
  if (flag === "true") return true;
  if (flag === "false") return false;
  return !process.env.GEMINI_API_KEY;
}
