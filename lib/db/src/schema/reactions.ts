import { pgTable, text, uuid, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { postsTable } from "./posts";

/**
 * Reactions on Trip Stories — the ranking signal behind "top rated".
 *
 * This has to exist because **TikTok gives us nothing to rank by**. Its oEmbed
 * endpoint returns title/author/thumbnail and no engagement counts at all; the
 * Display API only ever returns the authenticated user's own videos, and the
 * Research API is gated to academic institutions. There is no public way to ask
 * "which Riyadh videos are popular", so popularity has to be measured here, on
 * our own users' votes, or not measured at all.
 *
 * The unique index is the whole anti-gaming story for now: one row per
 * (user, post, kind) means the database refuses a double-vote rather than
 * trusting the route to check first. `kind` is in the key so a future
 * "bookmark" or "been there" cannot collide with a like.
 */
export const postReactionsTable = pgTable(
  "post_reactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => postsTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["like"] }).notNull().default("like"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("post_reactions_user_post_kind_idx").on(table.userId, table.postId, table.kind),
    index("post_reactions_post_id_idx").on(table.postId),
  ],
);

export const insertPostReactionSchema = createInsertSchema(postReactionsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertPostReaction = z.infer<typeof insertPostReactionSchema>;
export type PostReaction = typeof postReactionsTable.$inferSelect;
export type ReactionKind = PostReaction["kind"];
