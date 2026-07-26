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
  createdAt: string;
  updatedAt: string;
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
