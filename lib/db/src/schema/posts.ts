import { pgTable, text, uuid, timestamp, integer, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

/**
 * Trip Stories — creator posts anchored to a real city and a set of real POI
 * ids from the itinerary engine's own dataset, rather than freeform location
 * text. `poiIds` is not foreign-keyed (the POI dataset is a static JSON file,
 * not a DB table) — the API layer validates ids against that dataset at write
 * time instead.
 */
export const postsTable = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    creatorId: uuid("creator_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    content: text("content").notNull(),
    city: text("city").notNull(),
    poiIds: jsonb("poi_ids").notNull().$type<string[]>().default([]),
    tags: jsonb("tags").notNull().$type<string[]>().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("posts_creator_id_idx").on(table.creatorId),
    index("posts_city_idx").on(table.city),
  ],
);

export const postMediaTable = pgTable(
  "post_media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => postsTable.id, { onDelete: "cascade" }),
    type: text("type", { enum: ["image", "video", "tiktok"] }).notNull(),
    url: text("url").notNull(),
    tiktokVideoId: text("tiktok_video_id"),
    caption: text("caption"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [index("post_media_post_id_idx").on(table.postId)],
);

export const insertPostSchema = createInsertSchema(postsTable).omit({
  id: true,
  creatorId: true,
  createdAt: true,
  updatedAt: true,
});
export const insertPostMediaSchema = createInsertSchema(postMediaTable).omit({
  id: true,
  postId: true,
});

export type InsertPost = z.infer<typeof insertPostSchema>;
export type InsertPostMedia = z.infer<typeof insertPostMediaSchema>;
export type Post = typeof postsTable.$inferSelect;
export type PostMedia = typeof postMediaTable.$inferSelect;

export type PostWithMedia = Post & { media: PostMedia[] };

/** Public shape includes the creator's display name but never their email. */
export type PublicPost = PostWithMedia & { creatorName: string };
