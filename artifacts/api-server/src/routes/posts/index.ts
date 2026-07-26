/**
 * Trip Stories — creator posts anchored to real POI ids from the itinerary
 * engine's dataset. Reads are public (a story is meant to be discovered);
 * writes require a session, and edits/deletes are creator-only.
 */
import { Router, type IRouter } from "express";
import { eq, desc, and, inArray } from "drizzle-orm";
import {
  db,
  postsTable,
  postMediaTable,
  usersTable,
  type Post,
  type PostMedia,
  type PublicPost,
} from "@workspace/db";
import { requireSession } from "../../lib/session";
import { validateCreateRequest, validateUpdateRequest } from "./posts-validate";

const router: IRouter = Router();

const FEED_PAGE_SIZE = 20;

function toPublicPost(post: Post, creatorName: string, media: PostMedia[]): PublicPost {
  return {
    ...post,
    creatorName,
    media: [...media].sort((a, b) => a.sortOrder - b.sortOrder),
  };
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
  const mediaByPost = await loadMediaByPostId(filtered.map((r) => r.post.id));

  const posts = filtered.map((r) =>
    toPublicPost(r.post, r.creatorName, mediaByPost.get(r.post.id) ?? []),
  );
  res.json({ posts });
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

  const media = await db.select().from(postMediaTable).where(eq(postMediaTable.postId, row.post.id));
  res.json({ post: toPublicPost(row.post, row.creatorName, media) });
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
          .values(
            parsed.media.map((m, i) => ({
              postId: post.id,
              type: m.type,
              url: m.url,
              tiktokVideoId: m.tiktokVideoId ?? null,
              caption: m.caption ?? null,
              sortOrder: i,
            })),
          )
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
    await db.delete(postMediaTable).where(eq(postMediaTable.postId, post.id));
    media = await db
      .insert(postMediaTable)
      .values(
        newMedia.map((m, i) => ({
          postId: post.id,
          type: m.type,
          url: m.url,
          tiktokVideoId: m.tiktokVideoId ?? null,
          caption: m.caption ?? null,
          sortOrder: i,
        })),
      )
      .returning();
  }

  const [creator] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, post.creatorId));
  res.json({ post: toPublicPost(post, creator?.name ?? "", media) });
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
