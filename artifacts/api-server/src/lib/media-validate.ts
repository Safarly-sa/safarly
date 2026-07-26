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
