/**
 * TikTok oEmbed capture.
 *
 * Why store this at all: a ranked video feed cannot mount TikTok's embed.js per
 * card. Each embed is an iframe; twenty in one scroll view is unusable, and on
 * React Native embed.js does not exist at all. Fetching the thumbnail once at
 * write time lets both clients render cheap image cards and mount the real
 * embed only for the item being watched.
 *
 * Why it must never throw: this runs inside story creation. TikTok being slow,
 * rate-limiting us, or returning something unexpected is not a reason to reject
 * a traveller's story. Every failure path returns null and the columns stay
 * null, which the feed reads as "fall back to the live embed".
 *
 * Note what oEmbed does *not* return: view counts, like counts, any engagement
 * signal whatsoever. That is why ranking is built on our own `post_reactions`
 * rather than on anything TikTok reports.
 */
import { isTikTokUrl } from "./tiktok-url";
import { logger } from "./logger";

const OEMBED_ENDPOINT = "https://www.tiktok.com/oembed";
const TIMEOUT_MS = 3000;
const MAX_FIELD = 300;

export interface TikTokOEmbed {
  thumbnailUrl: string | null;
  authorName: string | null;
  title: string | null;
}

/**
 * Split from the fetch so the parsing rules are unit-testable without a
 * network call — the same reason posts-validate and media-validate are their
 * own modules.
 *
 * The thumbnail is held to https because it ends up in an `<img src>` on an
 * https page; an http one is blocked as mixed content, and since we persist it,
 * a bad value stays broken long after the request that stored it. A non-TikTok
 * CDN host is *not* rejected here — TikTok serves thumbnails off several
 * rotating CDN domains, so an allowlist would break on their infrastructure
 * changes. https + string caps is the honest boundary for an image URL.
 */
export function parseOEmbedResponse(raw: unknown): TikTokOEmbed | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as Record<string, unknown>;

  const str = (v: unknown): string | null =>
    typeof v === "string" && v.trim().length > 0 ? v.trim().slice(0, MAX_FIELD) : null;

  const thumbnail = str(body.thumbnail_url);
  let safeThumbnail: string | null = null;
  if (thumbnail) {
    try {
      safeThumbnail = new URL(thumbnail).protocol === "https:" ? thumbnail : null;
    } catch {
      safeThumbnail = null;
    }
  }

  const result: TikTokOEmbed = {
    thumbnailUrl: safeThumbnail,
    authorName: str(body.author_name),
    title: str(body.title),
  };

  // Nothing usable came back — let the caller store nulls rather than a row of
  // empty strings that reads like a successful fetch.
  if (!result.thumbnailUrl && !result.authorName && !result.title) return null;
  return result;
}

/**
 * Best-effort. Returns null on a non-TikTok URL, a timeout, a non-200, invalid
 * JSON, or an unusable body.
 *
 * The URL is validated as TikTok before use even though we only ever fetch our
 * own fixed endpoint — it is a caller-supplied value going into a query string,
 * and there is no reason to hand an arbitrary URL to TikTok on a user's behalf.
 */
export async function fetchTikTokOEmbed(videoUrl: string): Promise<TikTokOEmbed | null> {
  if (!isTikTokUrl(videoUrl)) return null;

  try {
    const response = await fetch(`${OEMBED_ENDPOINT}?url=${encodeURIComponent(videoUrl)}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: "application/json" },
    });
    if (!response.ok) return null;
    return parseOEmbedResponse(await response.json());
  } catch (error) {
    // Includes the timeout. Deliberately swallowed: enrichment is additive, and
    // a story must be creatable when TikTok is unreachable.
    logger.warn({ error: String(error) }, "tiktok oembed fetch failed");
    return null;
  }
}
