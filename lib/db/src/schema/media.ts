import { pgTable, uuid, text, timestamp, customType, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/** node-postgres already returns/accepts bytea as a Buffer — no mapping needed. */
const bytea = customType<{ data: Buffer }>({
  dataType() {
    return "bytea";
  },
});

/**
 * Uploaded Trip Story images, stored directly in Postgres rather than an
 * object store. No R2/S3 account, no payment method, nothing beyond the
 * DATABASE_URL this app already requires — the tradeoff is that reads are
 * proxied through our own server (GET /api/media/file/:id in
 * artifacts/api-server/src/routes/media.ts) instead of served by a CDN.
 * Rows are capped at a few MB each (see MAX_IMAGE_BYTES in
 * artifacts/api-server/src/lib/media-storage.ts) — fine for a handful of
 * story photos, not meant to hold video.
 */
export const mediaBlobsTable = pgTable(
  "media_blobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    uploaderId: uuid("uploader_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    contentType: text("content_type").notNull(),
    data: bytea("data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("media_blobs_uploader_id_idx").on(table.uploaderId)],
);

export type MediaBlob = typeof mediaBlobsTable.$inferSelect;
