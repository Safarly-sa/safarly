/**
 * Trip Stories — creator posts anchored to real POI ids from the itinerary
 * engine's dataset. Reads are public (a story is meant to be discovered);
 * writes require a session, and edits/deletes are creator-only.
 */
import { Router, type IRouter } from "express";
import { eq, desc, and, inArray, sql } from "drizzle-orm";
import {
  db,
  postsTable,
  postMediaTable,
  postReactionsTable,
  usersTable,
  type Post,
  type PostMedia,
  type PublicPost,
} from "@workspace/db";
import { pois } from "@workspace/poi-data";
import { requireSession, readSessionUser } from "../../lib/session";
import { fetchTikTokOEmbed } from "../../lib/tiktok-oembed";
import { validateCreateRequest, validateUpdateRequest } from "./posts-validate";
import { parseRankingQuery, GRAVITY, AGE_OFFSET_HOURS } from "./posts-ranking";
import type { PostMediaInput } from "./posts-types";

const router: IRouter = Router();

const FEED_PAGE_SIZE = 20;

/** Built once — the dataset is a static import, not a table. */
const poiById = new Map(pois.map((p) => [p.id, p]));

/**
 * Builds the rows for a post's media, enriching tiktok items with oEmbed
 * metadata so the feed can render a thumbnail without mounting an iframe.
 *
 * `existing` carries forward metadata already captured for the same URL. PATCH
 * replaces a post's media wholesale (delete + re-insert), so without this an
 * edit to a story's *title* would re-fetch every one of its videos from TikTok.
 *
 * Fetches run concurrently and each one is already failure-tolerant, so the
 * slowest this adds is one timeout regardless of how many videos a story has.
 */
async function buildMediaRows(
  postId: string,
  media: PostMediaInput[],
  existing: PostMedia[] = [],
) {
  const cached = new Map(existing.filter((m) => m.thumbnailUrl).map((m) => [m.url, m]));

  return Promise.all(
    media.map(async (m, i) => {
      const reuse = m.type === "tiktok" ? cached.get(m.url) : undefined;
      const oembed = m.type === "tiktok" && !reuse ? await fetchTikTokOEmbed(m.url) : null;

      return {
        postId,
        type: m.type,
        url: m.url,
        tiktokVideoId: m.tiktokVideoId ?? null,
        caption: m.caption ?? null,
        thumbnailUrl: reuse?.thumbnailUrl ?? oembed?.thumbnailUrl ?? null,
        authorName: reuse?.authorName ?? oembed?.authorName ?? null,
        oembedTitle: reuse?.oembedTitle ?? oembed?.title ?? null,
        sortOrder: i,
      };
    }),
  );
}

function toPublicPost(
  post: Post,
  creatorName: string,
  media: PostMedia[],
  likedByMe = false,
): PublicPost {
  return {
    ...post,
    creatorName,
    likedByMe,
    media: [...media].sort((a, b) => a.sortOrder - b.sortOrder),
  };
}

/**
 * Which of these posts the current viewer has liked.
 *
 * Reads stay public, so this resolves the session optionally rather than
 * guarding on it — a signed-out reader gets an empty set and every story reads
 * as unliked, which is exactly right.
 */
async function loadLikedPostIds(req: Parameters<typeof readSessionUser>[0], postIds: string[]): Promise<Set<string>> {
  if (postIds.length === 0) return new Set();
  const viewer = await readSessionUser(req);
  if (!viewer) return new Set();

  const rows = await db
    .select({ postId: postReactionsTable.postId })
    .from(postReactionsTable)
    .where(
      and(
        eq(postReactionsTable.userId, viewer.id),
        eq(postReactionsTable.kind, "like"),
        inArray(postReactionsTable.postId, postIds),
      ),
    );
  return new Set(rows.map((r) => r.postId));
}

async function loadMediaByPostId(postIds: string[]): Promise<Map<string, PostMedia[]>> {
  const byPost = new Map<string, PostMedia[]>();
  if (postIds.length === 0) return byPost;

  const rows = await db.select().from(postMediaTable).where(inArray(postMediaTable.postId, postIds));
  for (const row of rows) {
    const list = byPost.get(row.postId) ?? [];
    list.push(row);
    byPost.set(row.postId, list);
  }
  return byPost;
}

/* ── GET /api/posts — public feed, newest first ────────────────────────── */
router.get("/posts", async (req, res) => {
  const cursor = typeof req.query.before === "string" ? req.query.before : undefined;

  const rows = await db
    .select({ post: postsTable, creatorName: usersTable.name })
    .from(postsTable)
    .innerJoin(usersTable, eq(postsTable.creatorId, usersTable.id))
    .orderBy(desc(postsTable.createdAt))
    .limit(FEED_PAGE_SIZE);

  const filtered = cursor ? rows.filter((r) => r.post.id !== cursor) : rows;
  const postIds = filtered.map((r) => r.post.id);
  const [mediaByPost, likedIds] = await Promise.all([
    loadMediaByPostId(postIds),
    loadLikedPostIds(req, postIds),
  ]);

  const posts = filtered.map((r) =>
    toPublicPost(r.post, r.creatorName, mediaByPost.get(r.post.id) ?? [], likedIds.has(r.post.id)),
  );
  res.json({ posts });
});

/* ── GET /api/posts/top-videos ──────────────────────────────────────────── */
/**
 * Ranked TikTok clips. **Must stay above `/posts/:id`** — Express matches in
 * declaration order, so below it this path arrives as `id = "top-videos"` and
 * 404s as a missing story.
 *
 * The ranking is ours, not TikTok's: oEmbed reports no engagement counts, so
 * `posts.like_count` is the only popularity signal available. See
 * posts-ranking.ts for why it decays with age.
 */
router.get("/posts/top-videos", async (req, res) => {
  const { city, limit } = parseRankingQuery(req.query as Record<string, unknown>);
  const cityFilter = city ? sql`AND p.city = ${city}` : sql``;

  const result = await db.execute(sql`
    SELECT
      m.id,
      m.url,
      m.tiktok_video_id AS "tiktokVideoId",
      m.thumbnail_url   AS "thumbnailUrl",
      m.author_name     AS "authorName",
      m.oembed_title    AS "oembedTitle",
      m.caption,
      p.id              AS "postId",
      p.title           AS "postTitle",
      p.city,
      p.like_count      AS "likeCount",
      p.created_at      AS "createdAt",
      u.name            AS "creatorName"
    FROM post_media m
    JOIN posts p ON p.id = m.post_id
    JOIN users u ON u.id = p.creator_id
    WHERE m.type = 'tiktok' ${cityFilter}
    ORDER BY
      p.like_count::float
        / power(extract(epoch from (now() - p.created_at)) / 3600.0 + ${AGE_OFFSET_HOURS}, ${GRAVITY}) DESC,
      p.created_at DESC
    LIMIT ${limit}
  `);

  res.json({ videos: result.rows });
});

/* ── GET /api/posts/top-places ──────────────────────────────────────────── */
/**
 * Top-rated places, aggregated from the POI ids stories are anchored to.
 *
 * This query is the payoff of anchoring stories to real POI ids instead of
 * freeform location text — "top rated place in Riyadh" is a GROUP BY rather
 * than a text-clustering problem.
 *
 * Rows whose poi id is no longer in the dataset are dropped rather than
 * rendered as a bare id: the dataset is a static file that can be re-cut, and
 * a ranking entry naming a place we cannot describe or map is worse than one
 * fewer entry.
 *
 * Deliberately no minimum-story floor yet. One would stop a single enthusiastic
 * post from crowning a POI, but on a young dataset it renders the whole section
 * empty, which reads as broken rather than as honest. `storyCount` is returned
 * so the UI can show what the ranking rests on; reintroduce a floor once volume
 * supports it.
 */
router.get("/posts/top-places", async (req, res) => {
  const { city, limit } = parseRankingQuery(req.query as Record<string, unknown>);
  const cityFilter = city ? sql`AND p.city = ${city}` : sql``;

  const result = await db.execute(sql`
    SELECT
      poi.value          AS "poiId",
      SUM(p.like_count)::int AS score,
      COUNT(*)::int      AS "storyCount"
    FROM posts p, jsonb_array_elements_text(p.poi_ids) AS poi(value)
    WHERE 1 = 1 ${cityFilter}
    GROUP BY poi.value
    ORDER BY score DESC, "storyCount" DESC
    LIMIT ${limit}
  `);

  const places = (result.rows as Array<{ poiId: string; score: number; storyCount: number }>)
    .map((row) => {
      const poi = poiById.get(row.poiId);
      if (!poi) return null;
      return {
        poiId: poi.id,
        name: poi.name,
        city: poi.city,
        category: poi.category,
        lat: poi.lat,
        lng: poi.lng,
        // Same flag the itinerary's Verified/Estimated badge reads — a ranked
        // place with an approximate pin should not look researched.
        verified: poi.verified !== false,
        score: row.score,
        storyCount: row.storyCount,
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  res.json({ places });
});

/* ── GET /api/posts/:id ────────────────────────────────────────────────── */
router.get<{ id: string }>("/posts/:id", async (req, res) => {
  const [row] = await db
    .select({ post: postsTable, creatorName: usersTable.name })
    .from(postsTable)
    .innerJoin(usersTable, eq(postsTable.creatorId, usersTable.id))
    .where(eq(postsTable.id, req.params.id))
    .limit(1);

  if (!row) {
    res.status(404).json({ error: "Story not found." });
    return;
  }

  const [media, likedIds] = await Promise.all([
    db.select().from(postMediaTable).where(eq(postMediaTable.postId, row.post.id)),
    loadLikedPostIds(req, [row.post.id]),
  ]);
  res.json({ post: toPublicPost(row.post, row.creatorName, media, likedIds.has(row.post.id)) });
});

/* ── POST /api/posts ────────────────────────────────────────────────────── */
router.post("/posts", requireSession, async (req, res) => {
  const parsed = validateCreateRequest(req.body);
  if (!parsed) {
    res.status(400).json({ error: "Invalid story — check title, content, city and media." });
    return;
  }

  const [post] = await db
    .insert(postsTable)
    .values({
      creatorId: req.user!.id,
      title: parsed.title,
      content: parsed.content,
      city: parsed.city,
      poiIds: parsed.poiIds,
      tags: parsed.tags,
    })
    .returning();

  const media =
    parsed.media.length > 0
      ? await db
          .insert(postMediaTable)
          .values(await buildMediaRows(post.id, parsed.media))
          .returning()
      : [];

  const [creator] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, req.user!.id));
  res.status(201).json({ post: toPublicPost(post, creator?.name ?? "", media) });
});

/* ── PATCH /api/posts/:id — creator-only, partial update ────────────────── */
router.patch<{ id: string }>("/posts/:id", requireSession, async (req, res) => {
  const [existing] = await db.select().from(postsTable).where(eq(postsTable.id, req.params.id)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Story not found." });
    return;
  }
  if (existing.creatorId !== req.user!.id) {
    res.status(403).json({ error: "You can only edit your own stories." });
    return;
  }

  const parsed = validateUpdateRequest(req.body);
  if (!parsed) {
    res.status(400).json({ error: "Invalid update — check title, content, city and media." });
    return;
  }

  const { media: newMedia, ...fields } = parsed;
  const [post] =
    Object.keys(fields).length > 0
      ? await db
          .update(postsTable)
          .set({ ...fields, updatedAt: new Date() })
          .where(eq(postsTable.id, req.params.id))
          .returning()
      : [existing];

  let media = await db.select().from(postMediaTable).where(eq(postMediaTable.postId, post.id));
  if (newMedia) {
    // `media` here is the pre-edit set — passed in so unchanged videos keep the
    // oEmbed data already captured for them instead of being re-fetched.
    const rows = await buildMediaRows(post.id, newMedia, media);
    await db.delete(postMediaTable).where(eq(postMediaTable.postId, post.id));
    media = await db.insert(postMediaTable).values(rows).returning();
  }

  const [creator] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, post.creatorId));
  res.json({ post: toPublicPost(post, creator?.name ?? "", media) });
});

/* ── POST /api/posts/:id/like ───────────────────────────────────────────── */
/**
 * The unique index on (user, post, kind) is what actually enforces one vote per
 * user — `onConflictDoNothing` turns a double-tap into a no-op rather than a
 * 500, and the empty `returning()` is how we know not to double-count. Doing
 * the check with a SELECT first would leave a race between two concurrent
 * requests from the same user.
 */
router.post<{ id: string }>("/posts/:id/like", requireSession, async (req, res) => {
  const [post] = await db.select().from(postsTable).where(eq(postsTable.id, req.params.id)).limit(1);
  if (!post) {
    res.status(404).json({ error: "Story not found." });
    return;
  }
  // Self-votes are refused outright rather than silently uncounted, so the
  // ranking cannot be seeded by its own authors and the UI can say why.
  if (post.creatorId === req.user!.id) {
    res.status(403).json({ error: "You cannot like your own story." });
    return;
  }

  const likeCount = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(postReactionsTable)
      .values({ postId: post.id, userId: req.user!.id, kind: "like" })
      .onConflictDoNothing()
      .returning();

    if (inserted.length === 0) return post.likeCount;

    const [updated] = await tx
      .update(postsTable)
      .set({ likeCount: sql`${postsTable.likeCount} + 1` })
      .where(eq(postsTable.id, post.id))
      .returning({ likeCount: postsTable.likeCount });
    return updated.likeCount;
  });

  res.json({ likeCount, likedByMe: true });
});

/* ── DELETE /api/posts/:id/like ─────────────────────────────────────────── */
router.delete<{ id: string }>("/posts/:id/like", requireSession, async (req, res) => {
  const [post] = await db.select().from(postsTable).where(eq(postsTable.id, req.params.id)).limit(1);
  if (!post) {
    res.status(404).json({ error: "Story not found." });
    return;
  }

  const likeCount = await db.transaction(async (tx) => {
    const removed = await tx
      .delete(postReactionsTable)
      .where(
        and(
          eq(postReactionsTable.postId, post.id),
          eq(postReactionsTable.userId, req.user!.id),
          eq(postReactionsTable.kind, "like"),
        ),
      )
      .returning();

    if (removed.length === 0) return post.likeCount;

    const [updated] = await tx
      .update(postsTable)
      // GREATEST floors this at zero. The counter is denormalized, so a stray
      // decrement from a manual DB edit or an old bug would otherwise strand a
      // post at a negative count that no amount of unliking could repair.
      .set({ likeCount: sql`GREATEST(${postsTable.likeCount} - 1, 0)` })
      .where(eq(postsTable.id, post.id))
      .returning({ likeCount: postsTable.likeCount });
    return updated.likeCount;
  });

  res.json({ likeCount, likedByMe: false });
});

/* ── DELETE /api/posts/:id — creator-only ──────────────────────────────── */
router.delete<{ id: string }>("/posts/:id", requireSession, async (req, res) => {
  const [existing] = await db.select().from(postsTable).where(eq(postsTable.id, req.params.id)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Story not found." });
    return;
  }
  if (existing.creatorId !== req.user!.id) {
    res.status(403).json({ error: "You can only delete your own stories." });
    return;
  }

  await db.delete(postsTable).where(and(eq(postsTable.id, req.params.id), eq(postsTable.creatorId, req.user!.id)));
  res.status(204).end();
});

export default router;
