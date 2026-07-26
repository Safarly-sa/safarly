/**
 * Which browser origins may send credentialed requests.
 *
 * Split out of app.ts for the same reason the request validators are: this is
 * a security boundary, and it should be testable without booting Express. It
 * matters more than its size suggests — the session cookie is `SameSite=None`
 * in production (see routes/auth.ts), so this list, not the cookie, is what
 * stands between a foreign origin and an authenticated request.
 */

/**
 * Cloudflare Pages serves every branch and commit preview on its own
 * subdomain of the project host (`<branch>.safarly.pages.dev`), so an
 * exact-match allowlist blocks all of them and any API-backed feature is
 * untestable on a PR preview.
 *
 * Patterns are derived from the allowlist rather than configured separately,
 * so there is one place to trust a host and no second env var that can drift
 * into permitting something `CORS_ORIGIN` does not. Only `*.pages.dev`
 * entries get subdomain treatment; a future custom domain would not.
 */
export function buildPreviewPatterns(allowedOrigins: string[]): RegExp[] {
  return allowedOrigins
    .filter((o) => o.endsWith(".pages.dev"))
    .map((o) => {
      const host = o.replace(/^https:\/\//, "");
      // Anchored at both ends, and the dot before the host is part of the
      // pattern: `evil-safarly.pages.dev` and `safarly.pages.dev.evil.com`
      // must both fail.
      return new RegExp(`^https://[a-z0-9-]+\\.${host.replace(/\./g, "\\.")}$`);
    });
}

export function isOriginAllowed(
  origin: string,
  allowedOrigins: string[],
  previewPatterns: RegExp[],
  allowLocalhost: boolean,
): boolean {
  if (allowedOrigins.includes(origin)) return true;
  if (previewPatterns.some((re) => re.test(origin))) return true;
  if (allowLocalhost && /^http:\/\/localhost:\d+$/.test(origin)) return true;
  return false;
}
