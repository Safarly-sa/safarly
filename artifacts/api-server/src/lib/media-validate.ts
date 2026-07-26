/**
 * Split out from media-storage.ts so this has zero dependency on the DB
 * connection (media-storage.ts imports @workspace/db, which throws at import
 * time without DATABASE_URL set) — pure validation should be importable and
 * unit-testable on its own, same reasoning as posts-validate.ts.
 */
const ALLOWED_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/** Comfortably above what image.ts's client-side downscale produces (JPEG, ≤1600px, q0.82). */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export function isAllowedImageType(contentType: string): boolean {
  return ALLOWED_CONTENT_TYPES.has(contentType);
}

/**
 * The scheme is passed in, never read from `req.protocol`. Render terminates
 * TLS at its edge and forwards to the app over plain HTTP, so `req.protocol`
 * is "http" in production — and this URL is stored in `post_media.url` and
 * later rendered inside an https:// page, where an http:// image is mixed
 * content and silently blocked. A wrong scheme here persists a broken URL,
 * so the damage outlives the request that made it.
 *
 * `trust proxy` would also fix the scheme by honouring X-Forwarded-Proto, but
 * it changes how `req.ip` is derived, and `req.ip` is what the login rate
 * limiter buckets on — not a free swap, so it is deliberately not used.
 */
export function buildMediaUrl(host: string, id: string, isProduction: boolean): string {
  return `${isProduction ? "https" : "http"}://${host}/api/media/file/${id}`;
}
