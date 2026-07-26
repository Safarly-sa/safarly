/**
 * Trip Story image uploads, stored directly in Postgres (see
 * lib/db/src/schema/media.ts) instead of an external object store — no R2/S3
 * account or payment method needed, just the DATABASE_URL this app already
 * requires. Images only: video stays paste-a-link (TikTok already worked
 * this way; a raw video file would be too large for this approach).
 *
 * Pure validation lives in media-validate.ts, not here — this file imports
 * @workspace/db, which throws at import time without DATABASE_URL set.
 */
import { eq } from "drizzle-orm";
import { db, mediaBlobsTable } from "@workspace/db";
import { isAllowedImageType, MAX_IMAGE_BYTES } from "./media-validate";

export async function storeImage(
  uploaderId: string,
  contentType: string,
  data: Buffer,
): Promise<string | null> {
  if (!isAllowedImageType(contentType)) return null;
  if (data.byteLength === 0 || data.byteLength > MAX_IMAGE_BYTES) return null;

  const [row] = await db
    .insert(mediaBlobsTable)
    .values({ uploaderId, contentType, data })
    .returning({ id: mediaBlobsTable.id });
  return row.id;
}

export async function getImage(id: string): Promise<{ data: Buffer; contentType: string } | null> {
  const [row] = await db
    .select({ data: mediaBlobsTable.data, contentType: mediaBlobsTable.contentType })
    .from(mediaBlobsTable)
    .where(eq(mediaBlobsTable.id, id))
    .limit(1);
  return row ?? null;
}
