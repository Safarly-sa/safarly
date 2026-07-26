/**
 * Split out from the route module for the same reason as trip-validate.ts —
 * zero dependency on Express/session/DB machinery, importable and unit
 * testable on its own.
 *
 * poiIds are trusted as opaque strings, not cross-checked against the POI
 * dataset (that dataset is a frontend JSON file, not something api-server
 * currently loads) — accepted simplification for v1. Content is plain
 * markdown/text, not HTML, so there is no markup to sanitise; it is rendered
 * as text on the client, never dangerously-set as HTML.
 */
import type { PostCreateRequest, PostMediaInput } from "./posts-types";

const MAX_TITLE = 120;
const MAX_CONTENT = 8000;
const MAX_CITY = 80;
const MAX_TAG = 40;
const MAX_TAGS = 10;
const MAX_POI_IDS = 30;
const MAX_POI_ID_LEN = 60;
const MAX_MEDIA = 12;
const MAX_URL = 2000;
const MAX_CAPTION = 200;

const MEDIA_TYPES = new Set(["image", "video", "tiktok"]);

/**
 * Media URLs must be http(s). A `javascript:` URL reaching the client is a
 * stored-XSS hole, not a cosmetic problem: story-detail renders a tiktok
 * item's url as an anchor href (TikTokEmbed's "Watch on TikTok" link), so a
 * crafted {type:"tiktok", url:"javascript:..."} would execute on click.
 * `<img>`/`<video>` src wouldn't fire it in a current browser, but the type
 * is caller-supplied — this is checked once here for every type rather than
 * relying on which element each happens to render into today.
 */
function hasSafeUrlScheme(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:";
  } catch {
    // Relative or malformed — no origin to resolve against server-side, and
    // media is expected to be externally hosted, so reject rather than guess.
    return false;
  }
}

/**
 * Content is rendered as plain text/markdown on the client, never as raw
 * HTML — but strip `<script>` blocks here too, as defense in depth against a
 * future rendering path that forgets that rule.
 */
function stripScriptTags(value: string): string {
  return value.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "");
}

function toMedia(raw: unknown): PostMediaInput | null {
  const m = raw as Partial<PostMediaInput> | null;
  if (!m || typeof m !== "object") return null;
  if (typeof m.type !== "string" || !MEDIA_TYPES.has(m.type)) return null;
  if (typeof m.url !== "string" || !m.url.trim()) return null;

  const url = m.url.trim().slice(0, MAX_URL);
  if (!hasSafeUrlScheme(url)) return null;

  return {
    type: m.type as PostMediaInput["type"],
    url,
    tiktokVideoId: typeof m.tiktokVideoId === "string" ? m.tiktokVideoId.slice(0, 40) : undefined,
    caption: typeof m.caption === "string" ? m.caption.trim().slice(0, MAX_CAPTION) : undefined,
  };
}

export function validateCreateRequest(body: unknown): PostCreateRequest | null {
  const b = body as Partial<PostCreateRequest> | null;
  if (!b || typeof b !== "object") return null;
  if (typeof b.title !== "string" || !b.title.trim()) return null;
  if (typeof b.content !== "string" || !b.content.trim()) return null;
  if (typeof b.city !== "string" || !b.city.trim()) return null;
  if (!Array.isArray(b.poiIds)) return null;
  if (!Array.isArray(b.tags)) return null;
  if (!Array.isArray(b.media)) return null;

  const media = b.media.slice(0, MAX_MEDIA).map(toMedia).filter((m): m is PostMediaInput => m !== null);
  if (media.length === 0) return null;

  return {
    title: stripScriptTags(b.title.trim()).slice(0, MAX_TITLE),
    content: stripScriptTags(b.content.trim()).slice(0, MAX_CONTENT),
    city: b.city.trim().toLowerCase().slice(0, MAX_CITY),
    poiIds: [...new Set(b.poiIds.filter((v): v is string => typeof v === "string"))]
      .slice(0, MAX_POI_IDS)
      .map((id) => id.slice(0, MAX_POI_ID_LEN)),
    tags: [...new Set(b.tags.filter((v): v is string => typeof v === "string" && v.trim().length > 0))]
      .slice(0, MAX_TAGS)
      .map((tag) => tag.trim().slice(0, MAX_TAG)),
    media,
  };
}
