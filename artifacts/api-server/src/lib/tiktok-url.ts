/**
 * TikTok URL recognition — the trust boundary in front of tiktok-typed media.
 *
 * `posts-validate.ts` already rejects non-http(s) schemes, which stops the
 * stored-XSS case. It does not check *which host* a tiktok item points at, and
 * that gap has its own consequence: story-detail renders a tiktok item's url as
 * an anchor href and passes it to TikTokEmbed as `cite`, so
 * `{type:"tiktok", url:"https://evil.example/login"}` is stored happily and
 * renders as a TikTok embed whose "Watch on TikTok" link goes somewhere else.
 * That is a phishing surface wearing our own UI's clothes — https, so no
 * scheme check catches it.
 *
 * The frontend parses TikTok URLs too (`safarly/src/lib/tiktok.ts`), but that
 * is a convenience for the compose form, not a constraint on what a request can
 * contain. This is the copy that decides what gets stored.
 *
 * Matching is exact-hostname against an allowlist, never `endsWith` or
 * `includes`, for the same reason `cors-origin.ts` is: `tiktok.com.evil.com`
 * and `eviltiktok.com` both contain the string "tiktok.com".
 */
const TIKTOK_HOSTS = new Set([
  "tiktok.com",
  "www.tiktok.com",
  "m.tiktok.com",
  // Short-link hosts. They 301 to a /video/<id> URL, so they carry no id of
  // their own — isTikTokUrl accepts them, extractTikTokVideoId returns null,
  // and the caller decides whether an id was required.
  "vm.tiktok.com",
  "vt.tiktok.com",
]);

/**
 * https only. TikTok does not serve http, and an http URL stored here would
 * later render inside an https page as blocked mixed content — the same
 * persisted-breakage failure mode `buildMediaUrl` exists to avoid.
 */
export function isTikTokUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  return TIKTOK_HOSTS.has(url.hostname.toLowerCase());
}

/**
 * Video id from a canonical `/video/<digits>` path. Returns null for short
 * links (which resolve to one only after a redirect) and for anything whose
 * host we do not trust — an id parsed out of an attacker-controlled URL is not
 * a TikTok video id just because it is numeric.
 */
export function extractTikTokVideoId(value: string): string | null {
  if (!isTikTokUrl(value)) return null;
  const match = new URL(value).pathname.match(/\/video\/(\d+)/);
  return match ? match[1] : null;
}
