/**
 * Split out from the route module for the same reason as trip-validate.ts —
 * zero dependency on Express/session/DB machinery, importable and unit
 * testable on its own.
 *
 * poiIds are checked against the real dataset in @workspace/poi-data, the
 * same one the itinerary engine schedules from — the client picks from a
 * list, but nothing stops a crafted request, and an id that matches no place
 * would be stored forever and silently dropped at render time, leaving a
 * story that claims to tag somewhere it cannot show. Unknown ids are dropped
 * rather than rejecting the whole story: the rest of the post is still valid
 * and worth keeping.
 *
 * Content is plain markdown/text, not HTML, so there is no markup to
 * sanitise; it is rendered as text on the client, never dangerously-set as
 * HTML.
 */
import { isKnownPoiId } from "@workspace/poi-data";
import type { PostCreateRequest, PostMediaInput, PostUpdateRequest } from "./posts-types";

const MAX_TITLE = 120;
const MAX_CONTENT = 8000;
const MAX_CITY = 80;
const MAX_TAG = 40;
const MAX_TAGS = 10;
const MAX_POI_IDS = 30;
const MAX_MEDIA = 12;
const MAX_URL = 2000;
const MAX_CAPTION = 200;

const MEDIA_TYPES = new Set(["image", "video", "tiktok"]);

/** Deduped, capped, and filtered down to ids that name a real place. */
function toPoiIds(raw: unknown[]): string[] {
  return [...new Set(raw.filter((v): v is string => typeof v === "string"))]
    .filter(isKnownPoiId)
    .slice(0, MAX_POI_IDS);
}

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
    poiIds: toPoiIds(b.poiIds),
    tags: [...new Set(b.tags.filter((v): v is string => typeof v === "string" && v.trim().length > 0))]
      .slice(0, MAX_TAGS)
      .map((tag) => tag.trim().slice(0, MAX_TAG)),
    media,
  };
}

/**
 * PATCH body — every field is optional (only supplied fields change), but any
 * field that IS supplied is validated by the exact same rules as create. If
 * `media` is supplied it's a full replacement of the post's media, not a
 * merge — the route deletes and re-inserts, mirroring how the client's form
 * always sends its complete current media list.
 */
export function validateUpdateRequest(body: unknown): PostUpdateRequest | null {
  const b = body as Partial<PostCreateRequest> | null;
  if (!b || typeof b !== "object") return null;

  const update: PostUpdateRequest = {};

  if (b.title !== undefined) {
    if (typeof b.title !== "string" || !b.title.trim()) return null;
    update.title = stripScriptTags(b.title.trim()).slice(0, MAX_TITLE);
  }
  if (b.content !== undefined) {
    if (typeof b.content !== "string" || !b.content.trim()) return null;
    update.content = stripScriptTags(b.content.trim()).slice(0, MAX_CONTENT);
  }
  if (b.city !== undefined) {
    if (typeof b.city !== "string" || !b.city.trim()) return null;
    update.city = b.city.trim().toLowerCase().slice(0, MAX_CITY);
  }
  if (b.poiIds !== undefined) {
    if (!Array.isArray(b.poiIds)) return null;
    update.poiIds = toPoiIds(b.poiIds);
  }
  if (b.tags !== undefined) {
    if (!Array.isArray(b.tags)) return null;
    update.tags = [...new Set(b.tags.filter((v): v is string => typeof v === "string" && v.trim().length > 0))]
      .slice(0, MAX_TAGS)
      .map((tag) => tag.trim().slice(0, MAX_TAG));
  }
  if (b.media !== undefined) {
    if (!Array.isArray(b.media)) return null;
    const media = b.media.slice(0, MAX_MEDIA).map(toMedia).filter((m): m is PostMediaInput => m !== null);
    if (media.length === 0) return null;
    update.media = media;
  }

  return update;
}
