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
    /**
     * Denormalized count of `post_reactions` rows with kind "like". The source
     * of truth is still that table — this exists so the ranked feeds can sort
     * without a GROUP BY over every reaction on every read, and it is only ever
     * written in the same transaction as the reaction row it counts.
     */
    likeCount: integer("like_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("posts_creator_id_idx").on(table.creatorId),
    index("posts_city_idx").on(table.city),
    index("posts_like_count_idx").on(table.likeCount),
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
    /**
     * TikTok oEmbed metadata, captured server-side once at write time rather
     * than fetched per render.
     *
     * A ranked video feed cannot mount TikTok's embed.js for every card — each
     * embed is an iframe, and twenty of them in one scroll view is unusable.
     * With a cached thumbnail the feed renders cheap image cards and only
     * mounts the real embed for the item actually being watched. It also gives
     * a deleted or private video something to render as, which a bare embed
     * handles by silently collapsing.
     *
     * All three are nullable on purpose: oEmbed is a best-effort enrichment and
     * must never be able to fail a story submission. Null means "fall back to
     * the live embed", not "broken".
     */
    thumbnailUrl: text("thumbnail_url"),
    authorName: text("author_name"),
    oembedTitle: text("oembed_title"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [index("post_media_post_id_idx").on(table.postId)],
);

export const insertPostSchema = createInsertSchema(postsTable).omit({
  id: true,
  creatorId: true,
  // Server-owned: a client that could set its own like count could rank itself
  // to the top of every feed.
  likeCount: true,
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

/**
 * Public shape includes the creator's display name but never their email.
 *
 * `likedByMe` is viewer-relative, so it is part of the response shape rather
 * than the row: the same story is `true` for one reader and `false` for the
 * next, and it is always `false` for a signed-out reader.
 */
export type PublicPost = PostWithMedia & { creatorName: string; likedByMe: boolean };
