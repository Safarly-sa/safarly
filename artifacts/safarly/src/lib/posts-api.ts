/**
 * Calls to the Trip Stories API. Mirrors auth-api.ts conventions: same
 * API_BASE, `credentials: "include"` so the session cookie rides along on
 * writes, "never show raw server text" (error messages are already
 * human-authored server-side).
 */
const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

const OFFLINE_MESSAGE = "Can't reach the Safarly server. Make sure the API is running, then try again.";

export type PostMediaType = "image" | "video" | "tiktok";

export interface PostMedia {
  id: string;
  type: PostMediaType;
  url: string;
  tiktokVideoId: string | null;
  caption: string | null;
  /**
   * TikTok oEmbed metadata captured server-side at write time. Null means the
   * capture failed or predates it — render the live embed instead, not an
   * error. See the feed's lazy-mount note in TikTokVideoFeed.
   */
  thumbnailUrl: string | null;
  authorName: string | null;
  oembedTitle: string | null;
  sortOrder: number;
}

export interface Post {
  id: string;
  creatorId: string;
  creatorName: string;
  title: string;
  content: string;
  city: string;
  poiIds: string[];
  tags: string[];
  media: PostMedia[];
  likeCount: number;
  /** Viewer-relative, and always false when signed out. */
  likedByMe: boolean;
  createdAt: string;
  updatedAt: string;
}

/** A ranked TikTok clip — one row per tiktok media item, not per story. */
export interface TopVideo {
  id: string;
  url: string;
  tiktokVideoId: string | null;
  thumbnailUrl: string | null;
  authorName: string | null;
  oembedTitle: string | null;
  caption: string | null;
  postId: string;
  postTitle: string;
  city: string;
  likeCount: number;
  createdAt: string;
  creatorName: string;
}

export interface TopPlace {
  poiId: string;
  name: string;
  city: string;
  category: string;
  lat: number;
  lng: number;
  /** False means an approximate pin — same flag the itinerary badge reads. */
  verified: boolean;
  score: number;
  storyCount: number;
}

export interface PostMediaInput {
  type: PostMediaType;
  url: string;
  tiktokVideoId?: string;
  caption?: string;
}

export interface PostCreateInput {
  title: string;
  content: string;
  city: string;
  poiIds: string[];
  tags: string[];
  media: PostMediaInput[];
}

export type PostsResult = { ok: true; posts: Post[] } | { ok: false; error: string };
export type PostResult = { ok: true; post: Post } | { ok: false; error: string };

async function parseError(res: Response): Promise<string> {
  try {
    const payload = await res.json();
    return payload.error ?? `Something went wrong (${res.status}).`;
  } catch {
    return `Something went wrong (${res.status}).`;
  }
}

export async function fetchStories(): Promise<PostsResult> {
  try {
    const res = await fetch(`${API_BASE}/api/posts`);
    if (!res.ok) return { ok: false, error: await parseError(res) };
    const payload = await res.json();
    return { ok: true, posts: payload.posts ?? [] };
  } catch {
    return { ok: false, error: OFFLINE_MESSAGE };
  }
}

export async function fetchStory(id: string): Promise<PostResult> {
  try {
    const res = await fetch(`${API_BASE}/api/posts/${encodeURIComponent(id)}`);
    if (!res.ok) return { ok: false, error: await parseError(res) };
    const payload = await res.json();
    return { ok: true, post: payload.post };
  } catch {
    return { ok: false, error: OFFLINE_MESSAGE };
  }
}

export async function createStory(input: PostCreateInput): Promise<PostResult> {
  try {
    const res = await fetch(`${API_BASE}/api/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(input),
    });
    if (!res.ok) return { ok: false, error: await parseError(res) };
    const payload = await res.json();
    return { ok: true, post: payload.post };
  } catch {
    return { ok: false, error: OFFLINE_MESSAGE };
  }
}

export async function updateStory(id: string, input: Partial<PostCreateInput>): Promise<PostResult> {
  try {
    const res = await fetch(`${API_BASE}/api/posts/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(input),
    });
    if (!res.ok) return { ok: false, error: await parseError(res) };
    const payload = await res.json();
    return { ok: true, post: payload.post };
  } catch {
    return { ok: false, error: OFFLINE_MESSAGE };
  }
}

export type TopVideosResult = { ok: true; videos: TopVideo[] } | { ok: false; error: string };
export type TopPlacesResult = { ok: true; places: TopPlace[] } | { ok: false; error: string };

function rankingQuery(city?: string, limit?: number): string {
  const params = new URLSearchParams();
  if (city) params.set("city", city);
  if (limit) params.set("limit", String(limit));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/**
 * Ranked by likes cast here, on Safarly — not by anything TikTok reports.
 * TikTok's oEmbed carries no engagement counts, its Display API returns only
 * the caller's own videos, and its Research API is gated to academic
 * institutions, so there is no popularity signal to import.
 */
export async function fetchTopVideos(city?: string, limit?: number): Promise<TopVideosResult> {
  try {
    const res = await fetch(`${API_BASE}/api/posts/top-videos${rankingQuery(city, limit)}`);
    if (!res.ok) return { ok: false, error: await parseError(res) };
    const payload = await res.json();
    return { ok: true, videos: payload.videos ?? [] };
  } catch {
    return { ok: false, error: OFFLINE_MESSAGE };
  }
}

export async function fetchTopPlaces(city?: string, limit?: number): Promise<TopPlacesResult> {
  try {
    const res = await fetch(`${API_BASE}/api/posts/top-places${rankingQuery(city, limit)}`);
    if (!res.ok) return { ok: false, error: await parseError(res) };
    const payload = await res.json();
    return { ok: true, places: payload.places ?? [] };
  } catch {
    return { ok: false, error: OFFLINE_MESSAGE };
  }
}

export type LikeResult =
  | { ok: true; likeCount: number; likedByMe: boolean }
  | { ok: false; error: string };

/** `liked` is the state being requested, not the current one. */
export async function setStoryLike(id: string, liked: boolean): Promise<LikeResult> {
  try {
    const res = await fetch(`${API_BASE}/api/posts/${encodeURIComponent(id)}/like`, {
      method: liked ? "POST" : "DELETE",
      credentials: "include",
    });
    if (!res.ok) return { ok: false, error: await parseError(res) };
    const payload = await res.json();
    return { ok: true, likeCount: payload.likeCount, likedByMe: payload.likedByMe };
  } catch {
    return { ok: false, error: OFFLINE_MESSAGE };
  }
}

export type DeleteResult = { ok: true } | { ok: false; error: string };

export async function deleteStory(id: string): Promise<DeleteResult> {
  try {
    const res = await fetch(`${API_BASE}/api/posts/${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) return { ok: true };
    return { ok: false, error: await parseError(res) };
  } catch {
    return { ok: false, error: OFFLINE_MESSAGE };
  }
}
